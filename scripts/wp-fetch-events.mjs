/**
 * Fetches the old site's events.
 *
 * These need a different approach from everything else. The events live in the
 * `ai1ec_event` post type (All-in-One Event Calendar), which is NOT exposed
 * over the REST API — `/wp/v2/tribe_events`, the one that *is* exposed, belongs
 * to a second, unused calendar plugin and is empty. The RSS feed
 * (`?post_type=ai1ec_event&feed=rss2`) only ever returns the 10 most recent and
 * ignores `paged`.
 *
 * So: take the URL list from the sitemap and scrape each event page. The pages
 * carry no JSON-LD, but the plugin does leave machine-readable datetimes in
 * hidden divs, which is what makes this worth doing rather than parsing
 * "January 27, 2025 – February 4, 2025" by hand:
 *
 *     <div class="ai1ec-hidden dt-start">2022-05-01T00:00:00+00:00</div>
 *     <div class="ai1ec-hidden dt-end">2022-05-02T00:00:00+00:00</div>
 *
 * Run with:  npm run wp:fetch-events
 * Output:    .migration/events.json  (resumable)
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const SITE = 'https://archdioceseofmadrasmylapore.in'
const SITEMAP = `${SITE}/wp-sitemap-posts-ai1ec_event-1.xml`
const OUT = path.resolve('.migration')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
}

// The server rate-limits under sustained load; see wp-fetch.mjs.
const PACE_MS = 500

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const get = async (url, attempt = 1) => {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (!text.trim()) throw new Error('empty body')
    return text
  } catch (error) {
    if (attempt >= 4) throw new Error(`${url}: ${error.message}`)
    await sleep([0, 2000, 5000, 10000][attempt])
    return get(url, attempt + 1)
  }
}

const stripTags = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Decode the handful of entities that show up in these titles. */
const decode = (text) =>
  String(text ?? '')
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8216;/g, "'")

const parseEvent = (html, url) => {
  const pick = (regex) => {
    const match = regex.exec(html)
    return match ? match[1] : null
  }

  const start = pick(/dt-start[^>]*>([^<]+)</)
  const end = pick(/dt-end[^>]*>([^<]+)</)

  /**
   * The <h1> is the clean title. og:title appends the date --
   * "FBS General Chapter Inauguration Mass (M) (2022-05-01)" -- so it is only
   * a fallback, with that suffix stripped.
   */
  const title =
    decode(stripTags(pick(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/) ?? '')) ||
    decode(pick(/<meta property="og:title" content="([^"]+)"/) ?? '').replace(
      /\s*\(\d{4}-\d{2}-\d{2}\)\s*$/,
      '',
    )

  const location = stripTags(
    pick(
      /ai1ec-location[\s\S]{0,160}?ai1ec-field-value[^>]*>([\s\S]{0,200}?)<\/div>/,
    ) ?? '',
  )

  const displayed = stripTags(pick(/dt-duration[^>]*>([\s\S]{0,200}?)<\/div>/) ?? '')

  /**
   * These events carry no body text at all -- checked against the rendered
   * pages and the RSS `content:encoded`, both of which contain only the
   * When/Where block. Kept as a field in case that changes.
   */
  const bodyHtml =
    pick(/<div class="ai1ec-event-description[^"]*">([\s\S]*?)<\/div>\s*<\/div>/) ?? ''

  return {
    url,
    slug: url.replace(/\/$/, '').split('/').pop(),
    title: title || null,
    start,
    end,
    allDay: /ai1ec-allday-badge/.test(html),
    location: location || null,
    displayed: displayed || null,
    description: stripTags(bodyHtml) || null,
  }
}

const main = async () => {
  await fs.mkdir(OUT, { recursive: true })

  console.log('Reading event sitemap...')
  const sitemap = await get(SITEMAP)
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  console.log(`  ${urls.length} event URLs`)

  // Resume: keep anything already scraped successfully.
  let existing = new Map()
  try {
    const cached = JSON.parse(await fs.readFile(path.join(OUT, 'events.json'), 'utf8'))
    existing = new Map(cached.filter((item) => item.start).map((item) => [item.url, item]))
    if (existing.size) console.log(`  reusing ${existing.size} cached`)
  } catch {
    // No cache yet.
  }

  const results = new Map(existing)
  const failures = []
  let done = 0

  for (const url of urls) {
    done++
    if (results.has(url)) continue

    try {
      const html = await get(url)
      const event = parseEvent(html, url)
      results.set(url, event)
      process.stdout.write(`  ${done}/${urls.length} ${event.slug?.slice(0, 40) ?? ''}\r`)
    } catch (error) {
      failures.push({ url, error: error.message })
    }

    await sleep(PACE_MS)
  }

  process.stdout.write(' '.repeat(70) + '\r')

  const events = [...results.values()]
  await fs.writeFile(
    path.join(OUT, 'events.json'),
    JSON.stringify(events, null, 2),
    'utf8',
  )

  const withDates = events.filter((event) => event.start).length
  console.log(`\n  scraped ${events.length}/${urls.length}`)
  console.log(`  with machine-readable dates: ${withDates}`)
  console.log(`  all-day: ${events.filter((event) => event.allDay).length}`)
  console.log(`  with a location: ${events.filter((event) => event.location).length}`)
  if (failures.length) {
    console.log(`  FAILED: ${failures.length}`)
    failures.slice(0, 5).forEach((item) => console.log(`    ${item.url}: ${item.error}`))
  }

  console.log(`\nWrote ${path.join(OUT, 'events.json')}`)
}

await main()
