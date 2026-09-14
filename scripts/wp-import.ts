/**
 * Step 3 of the migration: write the cached WordPress content into Payload.
 *
 * Idempotent. Every imported record stores `legacy.wpId`, and the importer
 * matches on that (falling back to slug, so hand-seeded records are updated
 * rather than duplicated). Run it as many times as needed while refining the
 * mapping.
 *
 * Run with:  npm run wp:import
 *            npm run wp:import:dry          (report only, no writes)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import { getPayload } from 'payload'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import config from '@payload-config'

// Shared with the report script, so the dry run always matches the real import.
import {
  CATEGORY,
  CONTENT_SOURCE,
  classify,
  cleanSlug,
  plainText,
} from './wp-classify.mjs'
import {
  absoluteUrl,
  extractImages,
  linkifyTwoColumnTables,
  markImage,
  originalUrl,
  sanitizeWpHtml,
} from './wp-html.mjs'

const CACHE = path.resolve('.migration')
/**
 * Dry-run flag comes from the environment, NOT argv: `payload run` swallows
 * every argument after the script path, so `-- --dry` silently did nothing and
 * the first "dry run" wrote to the database for real.
 */
const DRY = process.env.WP_IMPORT_DRY === '1'

/** Slugs owned by real routes; a CMS page must not shadow them. */
const RESERVED_SLUGS = new Set([
  'clergy',
  'parishes',
  'news',
  'events',
  'admin',
  'api',
  'contact',
  'media',
])

type WpRecord = {
  id: number
  slug: string
  link?: string
  title?: { rendered?: string }
  content?: { rendered?: string }
  excerpt?: { rendered?: string }
  date?: string
  modified?: string
  featured_media?: number
  categories?: number[]
  contentUnavailable?: boolean
}

type WpMedia = {
  id: number
  source_url?: string
  alt_text?: string
  mime_type?: string
  title?: { rendered?: string }
}

type ScrapedEvent = {
  url: string
  slug: string
  title: string | null
  start: string | null
  end: string | null
  allDay: boolean
  location: string | null
  description: string | null
}

const read = async <T>(name: string): Promise<T> =>
  JSON.parse(await fs.readFile(path.join(CACHE, `${name}.json`), 'utf8')) as T

/** WordPress returns titles HTML-escaped: "St Mark&#8217;s Catholic Church". */
const decodeEntities = (input: string): string => {
  if (!input.includes('&')) return input
  const { window } = new JSDOM('<!doctype html><body>')
  const el = window.document.createElement('textarea')
  el.innerHTML = input
  return el.value
}

/**
 * Payload's HTML converter reads `data-lexical-upload-id` as a STRING, but this
 * database uses numeric ids, so the upload node's `value` arrives as "12"
 * instead of 12 and validation rejects it as "not a valid upload ID". Walk the
 * tree and coerce numeric-looking ids back to numbers.
 */
const normalizeUploadNodes = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(normalizeUploadNodes)
  if (!node || typeof node !== 'object') return node

  const record = node as Record<string, unknown>

  if (record.type === 'upload' && typeof record.value === 'string' && /^\d+$/.test(record.value)) {
    record.value = Number(record.value)
  }

  for (const key of ['root', 'children']) {
    if (key in record) record[key] = normalizeUploadNodes(record[key])
  }

  return record
}

/**
 * Drops upload nodes pointing at a given media id. Used when a priest's single
 * inline image is promoted to the `photo` field -- leaving it in the biography
 * as well would show the same portrait twice on the page.
 */
const removeUploadNode = (node: unknown, mediaId: number): unknown => {
  if (Array.isArray(node)) {
    return node
      .filter(
        (child) =>
          !(
            child &&
            typeof child === 'object' &&
            (child as Record<string, unknown>).type === 'upload' &&
            (child as Record<string, unknown>).value === mediaId
          ),
      )
      .map((child) => removeUploadNode(child, mediaId))
  }

  if (!node || typeof node !== 'object') return node

  const record = node as Record<string, unknown>
  for (const key of ['root', 'children']) {
    if (key in record) record[key] = removeUploadNode(record[key], mediaId)
  }
  return record
}

/** Labels used on the old priest pages, mapped to our fields. */
const CLERGY_LABELS: Record<string, 'address' | 'born' | 'ordination' | 'phone' | 'email'> = {
  address: 'address',
  born: 'born',
  'date of birth': 'born',
  ordination: 'ordination',
  ordained: 'ordination',
  mobile: 'phone',
  phone: 'phone',
  email: 'email',
  'e-mail': 'email',
}

/**
 * The old priest pages are a small structured record dressed up as prose:
 *
 *   <strong>Mobile</strong><br><span>9566145337</span>
 *
 * Parsing those into real fields does two things. It makes the data usable
 * (ordination dates become sortable, phone numbers searchable), and it keeps
 * personal contact details out of the public biography text -- the Clergy
 * collection deliberately hides them behind the `contactPublic` checkbox, and
 * dumping them into rich text would quietly defeat that.
 *
 * The contact rows are removed from the biography HTML; everything else stays.
 */
const extractClergyDetails = (html: string) => {
  const details: {
    assignment?: string
    address?: string
    born?: string
    ordination?: string
    phone?: string
    email?: string
  } = {}

  if (!html.trim()) return { html, details }

  const dom = new JSDOM(`<!doctype html><body>${html}</body>`)
  const { document } = dom.window

  let sawKnownLabel = false

  for (const strong of Array.from(document.querySelectorAll('strong'))) {
    const label = (strong.textContent ?? '').trim().toLowerCase().replace(/:$/, '')
    const field = CLERGY_LABELS[label]

    if (!field) {
      // The first bold line that is not a known label is the assignment
      // ("Diocesan Asst Parish Priest"), printed under the priest's name.
      if (!sawKnownLabel && !details.assignment) {
        const text = (strong.textContent ?? '').trim()
        if (text.length > 3 && text.length < 120) details.assignment = text
      }
      continue
    }

    sawKnownLabel = true

    // Value is whatever else the containing cell/paragraph says.
    const container = strong.closest('td, p, div, li') ?? strong.parentElement
    if (!container) continue

    const value = (container.textContent ?? '')
      .replace(strong.textContent ?? '', '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!value) continue
    if (!details[field]) details[field] = value

    // Contact details must not remain in the public biography.
    if (field === 'phone' || field === 'email' || field === 'address') {
      container.remove()
    }
  }

  return { html: document.body.innerHTML, details }
}

/** "1988-10-20" -> ISO date, or null if it is not a date we recognise. */
const parseDate = (value: string | undefined): string | null => {
  if (!value) return null
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

type StubProbe = {
  slug: string
  url: string
  textChars?: number
  html?: string
  error?: string
}

const OLD_SITE_HOST = 'archdioceseofmadrasmylapore.in'

/**
 * Works out what an "Elementor stub" page really was.
 *
 * These 14 pages return empty `content.rendered`, and the first assumption was
 * that Elementor held their layout in post meta. Scraping the live pages
 * (`npm run wp:probe-stubs`) showed something different: ten of them contain a
 * single link and no text -- they are navigation shortcuts to resources hosted
 * elsewhere, not content pages. The rest are dead widgets.
 *
 * Links back to the old site are NOT carried across: all three of them are
 * already broken there (/pastoral-letter and /website-links return 404, and
 * `others` links to itself).
 */
const readStub = (probe: StubProbe | undefined) => {
  if (!probe || probe.error || !probe.html) return { kind: 'unknown' as const }

  const links = [
    ...probe.html.matchAll(/<a[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi),
  ]

  if (links.length === 1 && (probe.textChars ?? 0) === 0) {
    const url = links[0][1]
    if (url.includes(OLD_SITE_HOST)) {
      return { kind: 'brokenLink' as const, url }
    }
    return { kind: 'externalLink' as const, url }
  }

  return { kind: 'deadWidget' as const }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const stats = {
  clergy: { created: 0, updated: 0 },
  parishes: { created: 0, updated: 0 },
  pages: { created: 0, updated: 0 },
  posts: { created: 0, updated: 0 },
  categories: { created: 0, updated: 0 },
  events: { created: 0, updated: 0, skipped: 0 },
  media: { created: 0, skipped: 0 },
  flagged: [] as { collection: string; slug: string; note: string }[],
  dropped: [] as {
    slug: string
    images: string[]
    imagesLinked: number
    embeds: string[]
    unwrappedLinks: number
  }[],
  inlineImages: { linked: 0, failed: 0 },
  errors: [] as { slug: string; error: string }[],
}

const main = async () => {
  const payload = await getPayload({ config })
  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  /**
   * WordPress HTML -> Lexical, with inline images imported into the media
   * library first so they become valid upload nodes.
   */
  const toLexical = async (html: string | undefined, label: string) => {
    const empty = { total: 0, linked: 0, failed: [] as string[], linkedIds: [] as number[] }
    const raw = (html ?? '').trim()
    if (!raw) return { state: null, images: empty }

    const { html: clean, embeds, unwrappedLinks } = sanitizeWpHtml(raw)
    if (!clean) return { state: null, images: empty }

    /**
     * The resource pages are two-column tables of "organisation name | VIEW
     * link". Lexical drops table structure, which separated each name from its
     * link, so those rows become a proper list with the name as the link text.
     */
    const { html: listified } = linkifyTwoColumnTables(clean)

    const { html: withUploads, images } = await attachUploads(listified, label)

    try {
      const state = normalizeUploadNodes(
        convertHTMLToLexical({ editorConfig, html: withUploads, JSDOM }),
      ) as ReturnType<typeof convertHTMLToLexical>

      if (images.total || embeds.length || unwrappedLinks) {
        stats.dropped.push({
          slug: label,
          images: images.failed,
          imagesLinked: images.linked,
          embeds,
          unwrappedLinks,
        })
      }

      return { state, images }
    } catch (error) {
      stats.flagged.push({
        collection: 'richText',
        slug: label,
        note: `HTML could not be converted: ${(error as Error).message}`,
      })
      return { state: null, images }
    }
  }

  /** Human-readable note about how the inline images fared. */
  const imageNote = (images: {
    total: number
    linked: number
    failed: string[]
  }): string | null => {
    if (images.total === 0) return null
    if (images.failed.length === 0) return null
    return `${images.failed.length} of ${images.total} inline image(s) could not be downloaded from the old site and need re-adding by hand.`
  }

  const [pages, posts, mediaList, wpCategories] = await Promise.all([
    read<WpRecord[]>('pages'),
    read<WpRecord[]>('posts'),
    read<WpMedia[]>('media'),
    read<{ id: number; slug: string; name: string }[]>('categories'),
  ])

  // What the "Elementor stub" pages actually contain (npm run wp:probe-stubs).
  const stubProbes = new Map<string, StubProbe>(
    (await read<StubProbe[]>('_stub-probe').catch(() => [])).map((item) => [
      item.slug,
      item,
    ]),
  )

  // Events come from a separate scrape (npm run wp:fetch-events).
  const wpEvents = await read<ScrapedEvent[]>('events').catch(() => [] as ScrapedEvent[])

  const mediaById = new Map(mediaList.map((item) => [item.id, item]))

  /**
   * `others` and `cbci-links` are empty nav shortcuts whose real content lives
   * in a near-duplicate (`others-3`, `cbci-links-2`). Serve the content from
   * the canonical URL and let the duplicate redirect to it -- see
   * CONTENT_SOURCE in wp-classify.mjs for why those specific copies won.
   */
  const pageBySlug = new Map(pages.map((record) => [record.slug, record]))

  const contentFor = (record: WpRecord): string | undefined => {
    const sourceSlug = (CONTENT_SOURCE as Record<string, string>)[record.slug]
    if (!sourceSlug) return record.content?.rendered
    return pageBySlug.get(sourceSlug)?.content?.rendered ?? record.content?.rendered
  }

  /** Find an existing doc by legacy id, then by slug. */
  const findExisting = async (collection: string, wpId: number, slug: string) => {
    const byLegacy = await payload.find({
      collection: collection as 'pages',
      where: { 'legacy.wpId': { equals: wpId } },
      limit: 1,
      depth: 0,
    })
    if (byLegacy.docs.length > 0) return byLegacy.docs[0]

    const bySlug = await payload.find({
      collection: collection as 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    return bySlug.docs[0] ?? null
  }

  const upsert = async (
    collection: 'clergy' | 'parishes' | 'pages' | 'posts' | 'categories',
    wpId: number,
    slug: string,
    data: Record<string, unknown>,
  ) => {
    const existing = await findExisting(collection, wpId, slug)

    if (DRY) {
      stats[collection][existing ? 'updated' : 'created']++
      return existing?.id ?? null
    }

    if (existing) {
      const updated = await payload.update({
        collection,
        id: existing.id,
        data: data as never,
        context: { disableRevalidate: true },
      })
      stats[collection].updated++
      return updated.id
    }

    const created = await payload.create({
      collection,
      data: data as never,
      context: { disableRevalidate: true },
    })
    stats[collection].created++
    return created.id
  }

  // ---- Media -------------------------------------------------------------
  /**
   * Media is keyed by the source URL rather than the WordPress attachment id,
   * because inline images in page content often have no id we can trust (and
   * WordPress serves resized variants like `photo-300x200.jpg`). Deduping on
   * the original URL means an image used on ten pages is downloaded once.
   */
  const mediaByUrl = new Map<string, number | null>()
  let counter = 0

  const PACE_MS = 250

  const importImageByUrl = async (
    url: string,
    meta: { alt?: string; wpId?: number | null },
  ): Promise<number | null> => {
    const key = originalUrl(url)
    if (mediaByUrl.has(key)) return mediaByUrl.get(key)!

    // Already imported by an earlier run?
    const existing = await payload.find({
      collection: 'media',
      where: { 'legacy.url': { equals: key } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      const id = existing.docs[0].id as number
      mediaByUrl.set(key, id)
      return id
    }

    if (DRY) {
      mediaByUrl.set(key, null)
      return null
    }

    // Prefer the full-size original; fall back to the resized URL we were given.
    for (const candidate of [key, url]) {
      try {
        const response = await fetch(candidate, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
          },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const type = response.headers.get('content-type') ?? ''
        if (!type.startsWith('image/')) throw new Error(`not an image (${type})`)

        const buffer = Buffer.from(await response.arrayBuffer())
        const filename =
          decodeURIComponent(candidate.split('/').pop()?.split('?')[0] ?? '') || 'image'
        // Write into a unique temp DIRECTORY rather than prefixing the
        // filename -- Payload stores whatever the file is called, and a
        // "wp-media-1789065377258-" prefix would end up in public image URLs.
        const tmpDir = path.join(os.tmpdir(), `wp-media-${Date.now()}-${counter++}`)
        await fs.mkdir(tmpDir, { recursive: true })
        const tmp = path.join(tmpDir, filename)
        await fs.writeFile(tmp, buffer)

        const created = await payload.create({
          collection: 'media',
          filePath: tmp,
          data: {
            alt: decodeEntities(meta.alt || '') || filename.replace(/\.[a-z]{3,4}$/i, ''),
            legacy: { wpId: meta.wpId ?? null, url: key },
          } as never,
          context: { disableRevalidate: true },
        })

        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        stats.media.created++
        mediaByUrl.set(key, created.id as number)
        await sleep(PACE_MS)
        return created.id as number
      } catch {
        // Try the next candidate URL.
      }
    }

    stats.media.skipped++
    mediaByUrl.set(key, null)
    await sleep(PACE_MS)
    return null
  }

  /** Featured image, looked up through the cached media index. */
  const importFeatured = async (wpMediaId: number): Promise<number | null> => {
    if (!wpMediaId) return null

    const source = mediaById.get(wpMediaId)
    if (!source?.source_url) {
      // 6362-6367 point at attachments that 404; 8754 returns 401.
      stats.flagged.push({
        collection: 'media',
        slug: String(wpMediaId),
        note: 'Featured image missing from the old site (deleted attachment or restricted).',
      })
      stats.media.skipped++
      return null
    }

    return importImageByUrl(source.source_url, {
      alt: source.alt_text || source.title?.rendered || '',
      wpId: wpMediaId,
    })
  }

  /**
   * Import every inline image and rewrite its tag so Payload's HTML converter
   * produces a valid upload node (see the note in wp-html.mjs). Images that
   * cannot be downloaded are removed rather than left to fail validation.
   */
  const attachUploads = async (html: string, label: string) => {
    const found = extractImages(html)
    if (found.length === 0) {
      return {
        html,
        images: { total: 0, linked: 0, failed: [] as string[], linkedIds: [] as number[] },
      }
    }

    let out = html
    let linked = 0
    const failed: string[] = []
    const linkedIds: number[] = []

    for (const image of found) {
      const url = absoluteUrl(image.src)

      if (!url) {
        out = out.replace(image.tag, '')
        failed.push(image.src ?? '(no src)')
        continue
      }

      const mediaId = await importImageByUrl(url, { alt: image.alt, wpId: image.wpId })

      if (mediaId) {
        out = out.replace(image.tag, markImage({ src: url, alt: image.alt }, mediaId))
        linked++
        if (!linkedIds.includes(mediaId)) linkedIds.push(mediaId)
      } else {
        out = out.replace(image.tag, '')
        failed.push(url)
      }
    }

    stats.inlineImages.linked += linked
    stats.inlineImages.failed += failed.length

    if (failed.length) {
      stats.flagged.push({
        collection: 'inlineImage',
        slug: label,
        note: `${failed.length} image(s) unavailable: ${failed.slice(0, 3).join(', ')}`,
      })
    }

    return { html: out, images: { total: found.length, linked, failed, linkedIds } }
  }

  /**
   * The old site has near-duplicate pages: `fr-a-amal-raj` / `fr-a-amal-raj-2`
   * (identical priest profiles), and `others` / `others-2` / `others-3`.
   *
   * These are NOT safe to dedupe automatically. For `others` and `cbci-links`
   * the base page is the empty Elementor stub and the "-2" holds the real
   * content, so a naive "drop the -2" rule would have deleted the good copy.
   * They are flagged for a human instead.
   */
  const importedSlugs = new Set<string>()
  for (const { record, type } of [
    ...pages.map((record) => ({ record, type: 'pages' as const })),
    ...posts.map((record) => ({ record, type: 'posts' as const })),
  ]) {
    const { category } = classify(record, type)
    if (!String(category).startsWith('skip')) importedSlugs.add(cleanSlug(record.slug))
  }

  const duplicateOf = (slug: string): string | null => {
    const match = /^(.*)-\d$/.exec(slug)
    return match && importedSlugs.has(match[1]) ? match[1] : null
  }

  const duplicateNote = (slug: string): string | null => {
    const base = duplicateOf(slug)
    return base
      ? `Possible duplicate of "${base}" on the old site -- compare the two and delete whichever is redundant.`
      : null
  }

  // ---- Categories --------------------------------------------------------
  const categoryIdByWpId = new Map<number, number>()
  for (const category of wpCategories) {
    const id = await upsert('categories', category.id, category.slug, {
      name: decodeEntities(category.name),
      slug: category.slug,
      legacy: { wpId: category.id, url: null, needsReview: false },
    })
    if (id) categoryIdByWpId.set(category.id, id as number)
  }

  // ---- Events ------------------------------------------------------------
  /**
   * All-day events are stored by the old plugin as midnight-to-midnight, but
   * with wildly inconsistent UTC offsets (`+00:00`, `-01:00`, `+07:00` all
   * appear). Reading the instant would shift some dates by a day, so for
   * all-day entries we take the DATE PART of the string verbatim and pin it to
   * UTC midnight -- which is what the old site displayed.
   */
  const eventDate = (iso: string | null, allDay: boolean): string | null => {
    if (!iso) return null

    if (allDay) {
      const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
      return datePart ? `${datePart[1]}T00:00:00.000Z` : null
    }

    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  /** Test entries someone left on the old calendar. */
  const isTestEvent = (event: ScrapedEvent) =>
    event.slug === 'test' || /^test\b/i.test(event.title ?? '')

  for (const event of wpEvents) {
    if (!event.start || !event.title || isTestEvent(event)) {
      stats.events.skipped++
      continue
    }

    // og:title used to append the date; strip it if a cached record still has it.
    const title = event.title.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim()
    const slug = cleanSlug(event.slug)
    const startDate = eventDate(event.start, event.allDay)
    if (!startDate) {
      stats.events.skipped++
      continue
    }

    try {
      // Scraping gives no WordPress post id, so these upsert on slug alone.
      const existing = await payload.find({
        collection: 'events',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })

      const data = {
        title,
        slug,
        startDate,
        endDate: eventDate(event.end, event.allDay),
        allDay: event.allDay,
        location: event.location ?? null,
        _status: 'published',
        legacy: {
          wpId: null,
          url: event.url,
          needsReview: false,
          reviewNote: null,
        },
      }

      if (DRY) {
        stats.events[existing.docs.length ? 'updated' : 'created']++
        continue
      }

      if (existing.docs.length) {
        await payload.update({
          collection: 'events',
          id: existing.docs[0].id,
          data: data as never,
          context: { disableRevalidate: true },
        })
        stats.events.updated++
      } else {
        await payload.create({
          collection: 'events',
          data: data as never,
          context: { disableRevalidate: true },
        })
        stats.events.created++
      }
    } catch (error) {
      stats.errors.push({ slug: event.slug, error: (error as Error).message })
    }
  }

  // ---- Everything else ---------------------------------------------------
  const rows = [
    ...pages.map((record) => ({ record, type: 'pages' as const })),
    ...posts.map((record) => ({ record, type: 'posts' as const })),
  ]

  let done = 0

  for (const { record, type } of rows) {
    const { category, reason } = classify(record, type)
    done++
    process.stdout.write(`  ${done}/${rows.length}\r`)

    if (String(category).startsWith('skip')) continue

    const title = decodeEntities(plainText(record.title?.rendered) || record.slug)
    const excerpt = decodeEntities(plainText(record.excerpt?.rendered)).slice(0, 500)
    const legacyUrl = record.link ?? null

    try {
      if (category === CATEGORY.CLERGY) {
        // "fr-a-amal-raj" -> slug "a-amal-raj"; the honorific is a field.
        const slug = cleanSlug(record.slug.replace(/^(fr|rev|msgr|most-rev)-/, ''))
        const honorific = record.slug.startsWith('msgr-')
          ? 'msgr'
          : record.slug.startsWith('most-rev-')
            ? 'mostRev'
            : record.slug.startsWith('rev-')
              ? 'rev'
              : 'fr'

        const name = decodeEntities(title).replace(/^(fr\.?|rev\.?|msgr\.?|most rev\.?)\s*/i, '')
        // Pull the structured record out of the prose, and strip the contact
        // rows from what remains so they are not published as biography text.
        const { html: bioHtml, details } = extractClergyDetails(
          record.content?.rendered ?? '',
        )

        const { state: bio, images: bioImages } = await toLexical(
          bioHtml,
          `clergy/${slug}`,
        )

        /**
         * The old priest pages carry no featured image -- the portrait is a
         * single inline image in the body. Promote it to `photo` so the
         * directory can show a face, and take it out of the biography so the
         * same picture is not rendered twice.
         */
        const featured = await importFeatured(record.featured_media ?? 0)
        const portrait =
          featured ?? (bioImages.linkedIds.length === 1 ? bioImages.linkedIds[0] : null)

        const bioWithoutPortrait =
          bio && portrait && !featured ? removeUploadNode(bio, portrait) : bio

        await upsert('clergy', record.id, slug, {
          name: name || slug,
          slug,
          honorific,
          status: 'active',
          currentAssignment: details.assignment ?? null,
          ordinationDate: parseDate(details.ordination),
          dateOfBirth: parseDate(details.born),
          // Stored, but hidden from the public site until someone ticks
          // "Show contact details" on the record.
          contactPublic: false,
          email: details.email && /@/.test(details.email) ? details.email : null,
          phone: details.phone ?? null,
          residenceAddress: details.address ?? null,
          ...(bioWithoutPortrait ? { bio: bioWithoutPortrait } : {}),
          photo: portrait,
          _status: 'published',
          legacy: {
            wpId: record.id,
            url: legacyUrl,
            needsReview:
              !bio || bioImages.failed.length > 0 || Boolean(duplicateNote(cleanSlug(record.slug))),
            reviewNote:
              [
                bio ? imageNote(bioImages) : 'No biography content came across from WordPress.',
                details.phone || details.email || details.address
                  ? 'Contact details were public on the old site; they are stored but hidden until "Show contact details" is ticked.'
                  : null,
                duplicateNote(cleanSlug(record.slug)),
              ]
                .filter(Boolean)
                .join(' ') || null,
          },
        })
        continue
      }

      if (category === CATEGORY.PARISH) {
        const { state: history, images: historyImages } = await toLexical(
          record.content?.rendered,
          `parish/${record.slug}`,
        )

        const parishSlug = cleanSlug(record.slug)
        await upsert('parishes', record.id, parishSlug, {
          name: title,
          slug: parishSlug,
          ...(history ? { history } : {}),
          _status: 'published',
          legacy: {
            wpId: record.id,
            url: legacyUrl,
            needsReview: true,
            reviewNote: [
              'Imported from WordPress: deanery, address, coordinates and mass timings still need to be filled in.',
              imageNote(historyImages),
              duplicateNote(parishSlug),
            ]
              .filter(Boolean)
              .join(' '),
          },
        })
        continue
      }

      if (category === CATEGORY.POST) {
        const { state: content, images: postImages } = await toLexical(
          record.content?.rendered,
          `post/${record.slug}`,
        )

        const postSlug = cleanSlug(record.slug)
        await upsert('posts', record.id, postSlug, {
          title,
          slug: postSlug,
          publishedAt: record.date ?? null,
          excerpt: excerpt || null,
          ...(content ? { content } : {}),
          featuredImage: await importFeatured(record.featured_media ?? 0),
          categories: (record.categories ?? [])
            .map((wpId) => categoryIdByWpId.get(wpId))
            .filter((id): id is number => typeof id === 'number'),
          _status: 'published',
          legacy: {
            wpId: record.id,
            url: legacyUrl,
            needsReview:
              !content || postImages.failed.length > 0 || Boolean(duplicateNote(postSlug)),
            reviewNote:
              [imageNote(postImages), duplicateNote(postSlug)].filter(Boolean).join(' ') || null,
          },
        })
        continue
      }

      // PAGE and PAGE_STUB
      let slug = cleanSlug(record.slug)
      if (RESERVED_SLUGS.has(slug)) {
        slug = `${slug}-page`
        stats.flagged.push({
          collection: 'pages',
          slug: record.slug,
          note: `Slug clashes with a real route; imported as "${slug}".`,
        })
      }

      const isStub = category === CATEGORY.PAGE_STUB
      const converted = isStub
        ? { state: null, images: { total: 0, linked: 0, failed: [] as string[], linkedIds: [] as number[] } }
        : await toLexical(contentFor(record), `page/${slug}`)
      const content = converted.state

      // For stubs, what the live page actually turned out to be.
      const stub = isStub ? readStub(stubProbes.get(slug)) : { kind: 'notStub' as const }

      const mergedFrom = (CONTENT_SOURCE as Record<string, string>)[record.slug]

      /**
       * Only `others` carries the dead Catholic Universe link -- see
       * CONTENT_SOURCE in wp-classify.mjs. Saying so on cbci-links too would
       * be wrong.
       */
      const mergeNote = mergedFrom
        ? [
            `Content merged from the old site's "${mergedFrom}" duplicate.`,
            record.slug === 'others'
              ? 'One outbound link (the Catholic Universe / Universe Catholic Weekly) is unreachable and needs checking.'
              : null,
          ]
            .filter(Boolean)
            .join(' ')
        : null

      const stubNote =
        stub.kind === 'externalLink'
          ? null // Resolved: it is a link to a resource elsewhere.
          : stub.kind === 'brokenLink'
            ? `The old page linked to ${stub.url}, which is already broken on the old site. Decide what this page should say, or retire it.`
            : stub.kind === 'deadWidget'
              ? 'The old page showed a daily-content widget that was empty ("No thoughts to display"). Decide whether to rebuild or retire it.'
              : 'Built with Elementor on the old site; content could not be recovered.'

      await upsert('pages', record.id, slug, {
        title,
        slug,
        excerpt: excerpt || null,
        ...(content ? { content } : {}),
        ...(stub.kind === 'externalLink' ? { externalUrl: stub.url } : {}),
        _status: 'published',
        legacy: {
          wpId: record.id,
          url: legacyUrl,
          needsReview:
            (isStub && stub.kind !== 'externalLink') ||
            (!isStub && !content) ||
            converted.images.failed.length > 0 ||
            Boolean(mergeNote) ||
            Boolean(duplicateNote(slug)),
          reviewNote: isStub
            ? stubNote
            : content
              ? [imageNote(converted.images), mergeNote, duplicateNote(slug)]
                  .filter(Boolean)
                  .join(' ') || null
              : `Content did not convert (${reason}).`,
        },
      })
    } catch (error) {
      stats.errors.push({ slug: record.slug, error: (error as Error).message })
    }
  }

  process.stdout.write(' '.repeat(30) + '\r')

  // ---- Report ------------------------------------------------------------
  console.log(`\n${DRY ? '--- DRY RUN (nothing written) ---' : '--- Import complete ---'}\n`)
  for (const key of ['clergy', 'parishes', 'pages', 'posts', 'events', 'categories'] as const) {
    const s = stats[key]
    console.log(`  ${key.padEnd(12)} created ${String(s.created).padStart(3)}   updated ${String(s.updated).padStart(3)}`)
  }
  console.log(`  ${'events skipped'.padEnd(12)} ${stats.events.skipped}`)
  console.log(`  ${'media'.padEnd(12)} created ${String(stats.media.created).padStart(3)}   unavailable ${stats.media.skipped}`)
  console.log(
    `
  inline images: ${stats.inlineImages.linked} linked, ${stats.inlineImages.failed} unavailable`,
  )

  if (stats.flagged.length > 0) {
    console.log(`\n  ${stats.flagged.length} items flagged for review:`)
    for (const item of stats.flagged.slice(0, 10)) {
      console.log(`    ${item.collection}/${item.slug}: ${item.note.slice(0, 90)}`)
    }
    if (stats.flagged.length > 10) console.log(`    ... and ${stats.flagged.length - 10} more`)
  }

  if (stats.errors.length > 0) {
    console.log(`\n  ${stats.errors.length} ERRORS:`)
    for (const item of stats.errors.slice(0, 15)) {
      console.log(`    ${item.slug}: ${item.error.slice(0, 120)}`)
    }
    if (stats.errors.length > 15) console.log(`    ... and ${stats.errors.length - 15} more`)
  }

  await fs.writeFile(
    path.join(CACHE, '_import-report.json'),
    JSON.stringify({ ranAt: new Date().toISOString(), dry: DRY, stats }, null, 2),
    'utf8',
  )
  console.log('\nWrote .migration/_import-report.json')
}

await main()
process.exit(0)
