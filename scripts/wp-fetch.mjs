/**
 * Step 1 of the migration: pull everything off the old WordPress site and
 * cache it on disk.
 *
 * Fetching and importing are deliberately separate. The import mapping needs
 * many iterations to get right, and re-downloading everything each time would
 * be slow and rude to their server.
 *
 * Three quirks of that server, all found the hard way:
 *
 *  1. RESPONSE SIZE CEILING. Anything much over ~20KB comes back as HTTP 200
 *     with an empty body. `?per_page=100` on media silently returned short or
 *     empty pages -- real data loss. `per_page=20` is reliable, and every page
 *     is verified against the expected count and retried if short.
 *
 *  2. LEAKED THEME HTML. Some responses have sidebar widget markup emitted
 *     before the JSON (`<div class="sidebar-widget">...{"id":...`), which is
 *     not valid JSON. We strip everything before the first { or [.
 *
 *  3. A HANDFUL OF PAGES ARE TOO BIG to return at all -- Elementor layout
 *     templates. Those are recorded metadata-only with contentUnavailable:true
 *     so the report can flag them instead of losing them silently.
 *
 * Run with:  npm run wp:fetch
 * Output:    .migration/*.json  (gitignored)
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const SITE = 'https://archdioceseofmadrasmylapore.in'
const API = `${SITE}/wp-json/wp/v2`
const OUT = path.resolve('.migration')

// The site returns 403 without a browser-like User-Agent.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept: 'application/json',
}

const PER_PAGE = 20

/**
 * Quirk 4: the server rate-limits. Sustained parallel requests produced
 * clustered network-level failures on consecutive ids (8021-8046) and on
 * consecutive media index pages. Slow and serial-ish is the only thing that
 * finishes cleanly, and the script is resumable so a partial run is never
 * wasted.
 */
const CONCURRENCY = 2
const PACE_MS = 400

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Quirk 2: drop any junk the theme printed before the JSON payload. */
const parseLoose = (text) => {
  if (!text.trim()) throw new Error('empty body (response size limit?)')

  const start = text.search(/[[{]/)
  if (start < 0) throw new Error('no JSON in response')

  return JSON.parse(text.slice(start))
}

const request = async (url, attempt = 1) => {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    return {
      data: parseLoose(await response.text()),
      total: Number(response.headers.get('x-wp-total') ?? 0),
      totalPages: Number(response.headers.get('x-wp-totalpages') ?? 1),
    }
  } catch (error) {
    if (attempt >= 5) throw new Error(`${url}: ${error.message}`)
    // Long backoff: these failures are rate limiting, not transient noise.
    await sleep([0, 2000, 5000, 10000, 20000][attempt])
    return request(url, attempt + 1)
  }
}

/**
 * Paginated index. Quirk 1: a page returning fewer than PER_PAGE items is not
 * necessarily the last page, so we drive the loop from x-wp-totalpages and
 * retry any page that comes back short.
 */
const fetchIndex = async (type, fields) => {
  const first = await request(`${API}/${type}?per_page=${PER_PAGE}&page=1&_fields=${fields}`)
  const { total, totalPages } = first

  const byId = new Map()
  const addAll = (items) => items.forEach((item) => byId.set(item.id, item))
  addAll(first.data)

  const shortPages = []

  for (let page = 2; page <= totalPages; page++) {
    const expected = page < totalPages ? PER_PAGE : total - PER_PAGE * (totalPages - 1)

    let got = []
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await request(
        `${API}/${type}?per_page=${PER_PAGE}&page=${page}&_fields=${fields}`,
      )
      got = result.data
      if (got.length >= expected) break
      await sleep(2000 * attempt)
    }

    if (got.length < expected) shortPages.push({ page, expected, got: got.length })
    addAll(got)
    process.stdout.write(`  ${type} index: ${byId.size}/${total}\r`)
    await sleep(PACE_MS)
  }

  process.stdout.write(' '.repeat(55) + '\r')
  const items = [...byId.values()]
  console.log(
    `  ${type} index: ${items.length}/${total}` +
      (shortPages.length ? `  (${shortPages.length} short pages)` : ''),
  )

  return { items, total, shortPages }
}

/** Fields worth keeping. Trimming these also shrinks the response. */
const CONTENT_FIELDS =
  'id,slug,link,title,content,excerpt,date,modified,parent,featured_media,status,categories'
const META_FIELDS = 'id,slug,link,title,date,modified,parent,featured_media,status'

/**
 * Full records, one id at a time. Quirk 3: if the full record is too large to
 * return, fall back to metadata only and mark it.
 */
const fetchFull = async (type, ids) => {
  const records = []
  const degraded = []
  const failures = []
  let done = 0

  const queue = [...ids]

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift()

      try {
        const { data } = await request(`${API}/${type}/${id}?_fields=${CONTENT_FIELDS}`)
        records.push(data)
      } catch {
        // Too big for their server. Keep the metadata so nothing vanishes.
        try {
          const { data } = await request(`${API}/${type}/${id}?_fields=${META_FIELDS}`)
          records.push({ ...data, contentUnavailable: true })
          degraded.push({ id, slug: data.slug })
        } catch (error) {
          failures.push({ id, error: error.message })
        }
      }

      done++
      process.stdout.write(`  ${type}: ${done}/${ids.length}\r`)
      await sleep(PACE_MS)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  process.stdout.write(' '.repeat(55) + '\r')
  console.log(
    `  ${type}: ${records.length} fetched` +
      (degraded.length ? `, ${degraded.length} metadata-only` : '') +
      (failures.length ? `, ${failures.length} FAILED` : ''),
  )

  return { records, degraded, failures }
}

const write = (name, data) =>
  fs.writeFile(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2), 'utf8')

/**
 * Resume support. Because the server rate-limits, a run can end partway
 * through; re-running should only ask for what is still missing rather than
 * hammering the whole site again. Records already fetched WITH content are
 * kept; metadata-only ones are retried in case the earlier failure was
 * transient.
 */
const readExisting = async (name) => {
  try {
    const raw = await fs.readFile(path.join(OUT, `${name}.json`), 'utf8')
    const items = JSON.parse(raw)
    return new Map(items.map((item) => [item.id, item]))
  } catch {
    return new Map()
  }
}

const main = async () => {
  await fs.mkdir(OUT, { recursive: true })
  console.log(`Fetching from ${SITE}\n`)

  const report = { fetchedAt: new Date().toISOString(), counts: {}, issues: {} }

  for (const type of ['pages', 'posts']) {
    const index = await fetchIndex(type, 'id,slug,modified')

    // Resume: keep what we already have with content, refetch the rest.
    const existing = await readExisting(type)
    const usable = new Map(
      [...existing].filter(([, record]) => !record.contentUnavailable),
    )
    const todo = index.items
      .map((item) => item.id)
      .filter((id) => !usable.has(id))

    if (usable.size > 0) {
      console.log(`  ${type}: reusing ${usable.size} cached, fetching ${todo.length}`)
    }

    const { records, degraded, failures } = await fetchFull(type, todo)

    const merged = new Map(usable)
    for (const record of records) merged.set(record.id, record)

    await write(type, [...merged.values()])
    report.counts[type] = { expected: index.total, fetched: merged.size }
    if (degraded.length) report.issues[`${type}:metadataOnly`] = degraded
    if (failures.length) report.issues[`${type}:failed`] = failures
    if (index.shortPages.length) report.issues[`${type}:shortIndexPages`] = index.shortPages
  }

  // Media: the slim index has everything the importer needs.
  const media = await fetchIndex('media', 'id,slug,source_url,alt_text,mime_type,title,date')

  // Union with any earlier run, so short index pages heal across attempts.
  const mediaMerged = await readExisting('media')
  for (const item of media.items) mediaMerged.set(item.id, item)

  await write('media', [...mediaMerged.values()])
  report.counts.media = { expected: media.total, fetched: mediaMerged.size }
  if (media.shortPages.length) report.issues['media:shortIndexPages'] = media.shortPages

  const categories = await fetchIndex('categories', 'id,slug,name,count,parent')
  await write('categories', categories.items)
  report.counts.categories = {
    expected: categories.total,
    fetched: categories.items.length,
  }

  await write('_fetch-report', report)

  console.log('\n--- Fetch summary ---')
  for (const [type, count] of Object.entries(report.counts)) {
    const ok = count.fetched === count.expected ? 'ok' : 'INCOMPLETE'
    console.log(`  ${type.padEnd(12)} ${count.fetched}/${count.expected}  ${ok}`)
  }
  if (Object.keys(report.issues).length > 0) {
    console.log('\n  Issues recorded in .migration/_fetch-report.json:')
    for (const [key, value] of Object.entries(report.issues)) {
      console.log(`    ${key}: ${value.length}`)
    }
  }

  console.log(`\nCached to ${OUT}`)
}

await main()
