/**
 * Turns the migrated photo gallery back into albums.
 *
 * The problem
 * -----------
 * The old gallery was a carousel plugin: a heading for each occasion, then a
 * slider of photographs under it. The migration kept the photographs — all 47
 * are in Media — but the carousel markup went with the plugin, leaving them
 * stacked one above the other at full width. The page is a 47-photograph
 * scroll in which the only thing separating one occasion from the next is a
 * heading you have already scrolled past.
 *
 * What this does
 * --------------
 * Walks the page in order. Every heading starts a new album; every image after
 * it belongs to that album until the next heading. That is exactly the
 * structure the page still has — it is just expressed as a sequence rather
 * than as nesting, so it can be read back.
 *
 * Headings with no photographs under them are not albums and are reported
 * rather than created: the old page has one, "ACADEMIC YEAR 2022- 2023", which
 * was a label over the section, not an occasion.
 *
 * The page itself is left intact and unpublished, so nothing is lost if the
 * grouping needs to be checked against the original.
 *
 * Alt text is repaired at the same time. WordPress had none, so the importer
 * fell back to the filename, and 47 photographs are described to a screen
 * reader as "20191223143737.0350690". The album title is at least true and at
 * least a description; every one is flagged for the archdiocese to replace.
 *
 * A warning that belongs with the photographs, not with the code: 44 of the 47
 * are 150x150 pixels and the other three are 398x398. That is not something
 * the migration did. The old site's "full size" link points at the same file —
 * whoever built that page uploaded WordPress thumbnails rather than the
 * photographs, and the originals were never on the website at all. They cannot
 * be recovered from it; the archdiocese has to supply them.
 *
 * Run with:  npm run albums:import
 *            ALBUMS_DRY=1 npm run albums:import
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.ALBUMS_DRY === '1'

const PAGE_SLUG = 'photo-gallery'

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
  value?: { id?: number | string } | number | string
  [key: string]: unknown
}

const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/** The ids of every image inside a node, in order. */
const imagesIn = (node: LexicalNode, found: (number | string)[] = []) => {
  if (node.type === 'upload') {
    const value = node.value
    const id =
      typeof value === 'object' && value !== null ? value.id : (value as number | string)
    if (id !== undefined && id !== null) found.push(id)
  }
  for (const child of node.children ?? []) imagesIn(child, found)
  return found
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

/**
 * The old headings are all in capitals, which on a page of tiles reads as
 * shouting. Title case is applied rather than left alone, but conservatively:
 * only the capitalisation changes, and a year run together with the word
 * before it — "CELEBRATION2019" — is separated, because that is a typo in the
 * original rather than a name.
 *
 * Every change is printed, so anything this gets wrong is visible and can be
 * corrected in the admin.
 */
const tidyTitle = (raw: string): string => {
  const spaced = raw
    .replace(/\s+/g, ' ')
    .replace(/([A-Za-z])(\d{4})\b/g, '$1 $2')
    .trim()

  const words = spaced.split(' ')

  return words
    .map((word, index) => {
      const lower = word.toLowerCase()
      const isEdge = index === 0 || index === words.length - 1

      if (!isEdge && SMALL_WORDS.has(lower)) return lower

      // Capitalise the first letter, leaving anything after it lowercase.
      return lower.replace(/^([a-z])/, (letter) => letter.toUpperCase())
    })
    .join(' ')
}

const main = async () => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
    locale: 'en',
    draft: true,
  })

  const page = result.docs[0]
  if (!page) {
    console.log(`  no page with slug "${PAGE_SLUG}"`)
    process.exit(1)
  }

  const content = page.content as { root?: LexicalNode } | null | undefined
  const children = content?.root?.children
  if (!children?.length) {
    console.log('  the page has no content')
    process.exit(1)
  }

  /** Headings in page order, each with the images that follow it. */
  const groups: { title: string; original: string; photos: (number | string)[] }[] = []
  const orphans: (number | string)[] = []

  for (const node of children) {
    if (node.type === 'heading') {
      const original = textOf(node).trim()
      if (original) groups.push({ title: tidyTitle(original), original, photos: [] })
      continue
    }

    const images = imagesIn(node)
    if (images.length === 0) continue

    if (groups.length === 0) orphans.push(...images)
    else groups[groups.length - 1].photos.push(...images)
  }

  const albums = groups.filter((group) => group.photos.length > 0)
  const empty = groups.filter((group) => group.photos.length === 0)

  console.log(`  ${groups.length} headings, ${albums.length} of them with photographs`)

  if (empty.length) {
    console.log(`  headings with no photographs (not imported as albums):`)
    for (const group of empty) console.log(`    ${group.original}`)
  }

  /**
   * Photographs before the first heading would belong to no album. There are
   * none on this page, but silently dropping them if that ever changed would
   * lose photographs, so it is reported.
   */
  if (orphans.length) {
    console.log(`  ${orphans.length} photographs appear before any heading and were skipped`)
  }

  console.log()

  /**
   * "20191223143737.0350690" is a camera filename, not a description. Anything
   * that is only digits, dots and dashes — or that simply repeats the file's
   * own name — is treated as missing.
   */
  const altIsMissing = (alt: string, filename: string): boolean => {
    const trimmed = alt.trim()
    if (!trimmed) return true
    if (/^[\d\s.\-x_]+$/.test(trimmed)) return true
    return trimmed === filename.replace(/\.[^.]+$/, '')
  }

  let created = 0
  let existing = 0
  let altFixed = 0
  let smallest = Infinity

  for (const album of albums) {
    /**
     * Repair the alt text first, so that a re-run still fixes it even when the
     * album itself is already there.
     */
    for (const id of album.photos) {
      const image = await payload.findByID({
        collection: 'media',
        id,
        depth: 0,
      })

      if (image.width) smallest = Math.min(smallest, image.width)
      if (!altIsMissing(image.alt ?? '', image.filename ?? '')) continue

      if (!DRY) {
        await payload.update({
          collection: 'media',
          id,
          data: {
            alt: `Photograph from ${album.title}`,
            legacy: {
              ...(image.legacy ?? {}),
              needsReview: true,
              reviewNote:
                'The description is a placeholder taken from the album title — the old site had none. Please describe what the photograph shows.',
            },
          } as never,
          context: { disableRevalidate: true },
        })
      }

      altFixed++
    }

    const already = await payload.find({
      collection: 'albums',
      where: { title: { equals: album.title } },
      limit: 1,
      depth: 0,
      draft: true,
    })

    if (already.docs.length > 0) {
      existing++
      continue
    }

    console.log(`  ${album.original}`)
    console.log(`    -> ${album.title}   (${album.photos.length} photographs)`)

    if (DRY) {
      created++
      continue
    }

    await payload.create({
      collection: 'albums',
      locale: 'en',
      data: {
        title: album.title,
        photos: album.photos,
        cover: album.photos[0],
        _status: 'published',
        legacy: {
          wpId: page.legacy?.wpId ?? null,
          url: page.legacy?.url ?? null,
          needsReview: true,
          reviewNote:
            'Imported from the old photo gallery. The heading became the album title and no date was recorded — please add the date it took place.',
        },
      } as never,
      context: { disableRevalidate: true },
    })

    created++
  }

  console.log(`\n  albums created: ${created}   already present: ${existing}`)
  console.log(`  photographs given a description in place of a filename: ${altFixed}`)

  /**
   * Say this out loud every run. A gallery of 150-pixel images looks like a
   * mistake in the new site, and it is not one — there is nothing better to
   * show until the archdiocese provides the originals.
   */
  if (Number.isFinite(smallest) && smallest < 800) {
    console.log(
      `\n  the smallest photograph is ${smallest}px wide. The old site holds only`,
    )
    console.log(
      `  WordPress thumbnails — the full-size originals were never uploaded to it,`,
    )
    console.log(`  so they have to come from the archdiocese.`)
  }

  if (!DRY && page._status === 'published') {
    await payload.update({
      collection: 'pages',
      id: page.id,
      data: {
        _status: 'draft',
        legacy: {
          ...(page.legacy ?? {}),
          needsReview: true,
          reviewNote:
            'Superseded by the photo gallery route, which reads the Albums collection. Kept as a draft so the original grouping can be checked.',
        },
      } as never,
      context: { disableRevalidate: true },
    })
    console.log(`  unpublished the migrated /${PAGE_SLUG} page`)
  }

  if (DRY) console.log('\nDry run. Re-run without ALBUMS_DRY=1 to apply.')
  process.exit(0)
}

await main()
