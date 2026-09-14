/**
 * Rebuilds the video gallery from the six videos the old site embedded.
 *
 * The problem
 * -----------
 * The old page was six `<iframe>` elements pasted into the WordPress editor.
 * Lexical has no iframe node, so the migration turned every one of them into a
 * link whose text was the embed address:
 *
 *   https://www.youtube.com/embed/wjHUQfhIEWk?feature=oembed
 *
 * Six of those, one after another. Nothing plays, and nothing tells a reader
 * what any of them is — the titles were in the iframes' `title` attributes,
 * which went with the iframes.
 *
 * What this does
 * --------------
 * Reads the video ids out of the original WordPress HTML (kept in
 * .migration/pages.json), then asks YouTube's oEmbed endpoint for each one.
 * That gives the title as it stands today and the channel that published it —
 * better than the migrated attributes, and it proves the video still exists.
 * The thumbnail is downloaded into Media so that the gallery can be rendered
 * without calling YouTube at all until a visitor presses play.
 *
 * Run with:  npm run videos:import
 *            VIDEOS_DRY=1 npm run videos:import
 */

import fs from 'node:fs/promises'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.VIDEOS_DRY === '1'

const PAGE_SLUG = 'video-gallery'
const MIGRATION_PAGES = '.migration/pages.json'

type WpPage = {
  slug?: string
  content?: { rendered?: string } | string
}

type OEmbed = {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

const contentOf = (page: WpPage): string => {
  if (typeof page.content === 'string') return page.content
  return page.content?.rendered ?? ''
}

/**
 * A date stated in the video's own title: "... Diocese 22-03-2020".
 *
 * Only an unambiguous, complete date is taken. Three of the six titles are raw
 * camera filenames — "VID 20200423 WA0005" — where the digits are very likely
 * the date the file was recorded, but "very likely" is not good enough to
 * print on a diocesan website as fact. Those are left undated and flagged for
 * the archdiocese instead.
 */
const dateInTitle = (title: string): string | null => {
  const match = title.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/)
  if (!match) return null

  const [, day, month, year] = match.map(Number) as unknown as number[]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString()
}

/** "VID 20200423 WA0005" — a filename, not a title anybody chose. */
const looksLikeAFilename = (title: string): boolean =>
  /^(vid|img|video|photo)[\s_-]?\d{6,}/i.test(title.trim())

const main = async () => {
  const payload = await getPayload({ config })

  const raw = await fs.readFile(MIGRATION_PAGES, 'utf8')
  const parsed = JSON.parse(raw) as WpPage[] | { pages?: WpPage[]; docs?: WpPage[] }
  const pages = Array.isArray(parsed) ? parsed : (parsed.pages ?? parsed.docs ?? [])

  const source = pages.find((page) => (page.slug ?? '').startsWith(PAGE_SLUG))
  if (!source) {
    console.log(`  no "${PAGE_SLUG}" page in ${MIGRATION_PAGES}`)
    process.exit(1)
  }

  const html = contentOf(source)
  const ids = [...html.matchAll(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/g)].map(
    (match) => match[1],
  )
  const unique = [...new Set(ids)]

  console.log(`  ${ids.length} embeds on the old page, ${unique.length} distinct\n`)

  let created = 0
  let existing = 0
  const failures: string[] = []
  const flagged: string[] = []

  for (const youtubeId of unique) {
    const already = await payload.find({
      collection: 'videos',
      where: { youtubeId: { equals: youtubeId } },
      limit: 1,
      depth: 0,
      draft: true,
    })

    if (already.docs.length > 0) {
      existing++
      continue
    }

    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`

    let info: OEmbed = {}
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      )
      /**
       * 401 or 404 here means the video has been removed or made private.
       * Importing it anyway would put a dead player on the page, so it is
       * reported and skipped — the archdiocese can then decide whether to
       * re-upload it or let it go.
       */
      if (!response.ok) throw new Error(`YouTube says HTTP ${response.status}`)
      info = (await response.json()) as OEmbed
    } catch (error) {
      failures.push(`${youtubeId} — ${(error as Error).message}`)
      continue
    }

    const title = (info.title ?? '').trim() || youtubeId
    const channel = (info.author_name ?? '').trim() || null
    const recordedOn = dateInTitle(title)
    const filename = looksLikeAFilename(title)

    if (DRY) {
      console.log(`  would import: ${title}`)
      console.log(`      channel: ${channel ?? 'unknown'}   date: ${recordedOn?.slice(0, 10) ?? '—'}`)
      created++
      continue
    }

    /**
     * The still image. `maxresdefault` is the full-size frame and is what a
     * modern upload has; older videos only have `hqdefault`, which is what
     * oEmbed points at. Try the good one, fall back to the one we know exists.
     */
    let thumbnailId: number | string | null = null

    for (const url of [
      `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
      info.thumbnail_url ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    ]) {
      try {
        const response = await fetch(url)
        if (!response.ok) continue

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.byteLength === 0) continue

        const media = await payload.create({
          collection: 'media',
          data: {
            alt: `Still from the video: ${title}`,
            legacy: { wpId: null, url, needsReview: false, reviewNote: null },
          } as never,
          file: {
            data: buffer,
            name: `video-${youtubeId}.jpg`,
            mimetype: 'image/jpeg',
            size: buffer.byteLength,
          },
          context: { disableRevalidate: true },
        })

        thumbnailId = media.id
        break
      } catch {
        // Try the next size; a video without a usable still is still worth
        // importing, it just shows a plain play card.
      }
    }

    const reviewNote = filename
      ? 'The title is the camera’s own filename, taken from YouTube. Please give the video a proper title — and confirm the date, which the filename suggests but does not state.'
      : null

    await payload.create({
      collection: 'videos',
      locale: 'en',
      data: {
        title,
        youtubeId,
        channel,
        recordedOn,
        thumbnail: thumbnailId,
        _status: 'published',
        legacy: {
          wpId: null,
          url: watchUrl,
          needsReview: filename,
          reviewNote,
        },
      } as never,
      context: { disableRevalidate: true },
    })

    created++
    console.log(`  + ${title}`)
    console.log(
      `      ${channel ?? 'channel unknown'}   ${recordedOn?.slice(0, 10) ?? 'no date'}   ${
        thumbnailId ? 'thumbnail saved' : 'NO THUMBNAIL'
      }`,
    )

    if (filename) flagged.push(title)
  }

  console.log(`\n  imported: ${created}   already held: ${existing}`)

  if (flagged.length) {
    console.log(`\n  titles that are camera filenames — flagged for the archdiocese:`)
    for (const title of flagged) console.log(`    ${title}`)
  }

  if (failures.length) {
    console.log(`\n  could not be imported:`)
    for (const line of failures) console.log(`    ${line}`)
  }

  /**
   * Retire the migrated page: /video-gallery is a real route now, and the two
   * cannot both answer at that address.
   */
  if (!DRY) {
    const page = await payload.find({
      collection: 'pages',
      where: { slug: { equals: PAGE_SLUG } },
      limit: 1,
      depth: 0,
      draft: true,
    })

    const doc = page.docs[0]
    if (doc && doc._status === 'published') {
      await payload.update({
        collection: 'pages',
        id: doc.id,
        data: {
          _status: 'draft',
          legacy: {
            ...(doc.legacy ?? {}),
            needsReview: true,
            reviewNote:
              'Superseded by the video gallery route, which reads the Videos collection.',
          },
        } as never,
        context: { disableRevalidate: true },
      })
      console.log(`\n  unpublished the migrated /${PAGE_SLUG} page`)
    }
  }

  if (DRY) console.log('\nDry run. Re-run without VIDEOS_DRY=1 to apply.')
  process.exit(0)
}

await main()
