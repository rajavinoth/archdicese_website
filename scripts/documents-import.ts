/**
 * Turns the migrated "title / Download" prose into real document records.
 *
 * The problem
 * -----------
 * /forms came across from WordPress as alternating paragraphs — a title, then
 * a paragraph containing nothing but a link labelled "Downloard" (the typo is
 * the old site's). Rendered as prose that is a wall of text with no spacing,
 * no indication of what any file is, and no way to tell a Tamil form from an
 * English one.
 *
 * Worse, every link points into the old site's uploads folder. The day that
 * site is switched off, every form the archdiocese offers 404s.
 *
 * What this does
 * --------------
 * Walks the page content looking for that exact shape — a paragraph of plain
 * text followed by a paragraph whose only content is a link to a file — and
 * for each pair:
 *
 *   1. downloads the file into the Documents collection, so the new site owns
 *      it rather than borrowing it
 *   2. records the title from the preceding paragraph
 *   3. attaches it to the page's `documents` field
 *   4. removes both paragraphs from the rich text, so the page does not show
 *      the same list twice
 *
 * Anything that does not match the pattern is left exactly as it is. A page
 * with a genuine paragraph that happens to precede a link keeps both, because
 * the link paragraph must contain *only* the link for the pair to count.
 *
 * Run with:  npm run documents:import
 *            DOCUMENTS_DRY=1 npm run documents:import
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.DOCUMENTS_DRY === '1'

/**
 * Pages whose content is a flat list of "title / Download" pairs.
 *
 * `news-letter-2` and `fcra-report` are document libraries too, but a
 * different shape: 86 and 34 file links respectively, grouped by year and
 * quarter, with several links inside a single paragraph — what was a tabbed
 * Elementor widget before it was flattened. They need grouping by year to be
 * worth anything, which is a different model from this flat one, so they are
 * deliberately left as they are rather than half-converted.
 */
const PAGES = ['forms']

const FILE_PATTERN = /\.(pdf|docx?|xlsx?)(\?|$)/i

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  fields?: { url?: string; [key: string]: unknown }
  [key: string]: unknown
}

/** All the text inside a node, flattened. */
const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/**
 * If this paragraph is nothing but a link to a file, return that URL.
 * "Nothing but" matters: a sentence with a link in the middle of it is prose,
 * not a download row, and must be left alone.
 */
const soleFileLink = (node: LexicalNode): string | null => {
  if (node.type !== 'paragraph') return null

  const children = (node.children ?? []).filter(
    (child) => !(typeof child.text === 'string' && child.text.trim() === ''),
  )
  if (children.length !== 1) return null

  const link = children[0]
  if (link.type !== 'link' && link.type !== 'autolink') return null

  const url = typeof link.fields?.url === 'string' ? link.fields.url : null
  if (!url || !FILE_PATTERN.test(url)) return null

  return url
}

/** A plain-text paragraph usable as a title. */
const titleParagraph = (node: LexicalNode): string | null => {
  if (node.type !== 'paragraph') return null
  if ((node.children ?? []).some((child) => child.type === 'link')) return null

  const text = textOf(node).trim()
  if (!text || text.length > 120) return null
  return text
}

const languageOf = (title: string): 'tamil' | 'english' =>
  /tamil|தமிழ்/i.test(title) ? 'tamil' : 'english'

const main = async () => {
  const payload = await getPayload({ config })

  let documentsCreated = 0
  let documentsExisting = 0
  let pagesChanged = 0
  const failures: string[] = []

  for (const slug of PAGES) {
    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      locale: 'en',
    })

    const page = result.docs[0]
    if (!page) {
      console.log(`  ${slug}: no such page`)
      continue
    }

    const content = page.content as { root?: LexicalNode } | null | undefined
    const children = content?.root?.children
    if (!children?.length) {
      console.log(`  ${slug}: no content to convert`)
      continue
    }

    const kept: LexicalNode[] = []
    const attached: (number | string)[] = []
    /** Counted separately: a dry run matches pairs without attaching them. */
    let matched = 0
    let index = 0

    while (index < children.length) {
      const title = titleParagraph(children[index])
      const url = index + 1 < children.length ? soleFileLink(children[index + 1]) : null

      if (!title || !url) {
        kept.push(children[index])
        index++
        continue
      }

      // A matching pair. Fetch the file once; re-runs reuse what is there.
      const filename = decodeURIComponent(url.split('/').pop() ?? '').split('?')[0]

      const existing = await payload.find({
        collection: 'documents',
        where: { 'legacy.url': { equals: url } },
        limit: 1,
        depth: 0,
      })

      matched++

      if (existing.docs.length > 0) {
        attached.push(existing.docs[0].id)
        documentsExisting++
        index += 2
        continue
      }

      if (DRY) {
        console.log(`  would fetch: ${title}  <-  ${filename}`)
        documentsCreated++
        index += 2
        continue
      }

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'ADMM-website-migration/1.0' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.byteLength === 0) throw new Error('empty file')

        const created = await payload.create({
          collection: 'documents',
          locale: 'en',
          data: {
            title,
            language: languageOf(title),
            legacy: {
              wpId: null,
              url,
              needsReview: false,
              reviewNote: null,
            },
          } as never,
          file: {
            data: buffer,
            name: filename,
            mimetype: response.headers.get('content-type') ?? 'application/pdf',
            size: buffer.byteLength,
          },
          context: { disableRevalidate: true },
        })

        attached.push(created.id)
        documentsCreated++
        console.log(`  + ${title}  (${Math.round(buffer.byteLength / 1024)} KB)`)
      } catch (error) {
        // A file that cannot be fetched keeps its original paragraphs, so the
        // page still links to it rather than losing it silently.
        failures.push(`${slug}: ${title} — ${(error as Error).message}`)
        kept.push(children[index], children[index + 1])
      }

      index += 2
    }

    /**
     * Drop a leftover paragraph that only repeats the page's own title.
     *
     * WordPress pages habitually restate their heading in the body, which was
     * invisible while the body was a wall of links and obvious once it became
     * a short page: /forms showed "FORMS" as the h1 and "FORMS" again directly
     * beneath it. Only an exact match is removed, and only when it is all that
     * is left, so a real paragraph that happens to begin with the title
     * survives.
     */
    const strippedHeading =
      kept.length === 1 &&
      textOf(kept[0]).trim().toLowerCase() === page.title.trim().toLowerCase()

    const finalChildren = strippedHeading ? [] : kept

    if (matched === 0 && !strippedHeading) {
      console.log(`  ${slug}: nothing matched the pattern`)
      continue
    }

    if (strippedHeading) {
      console.log(`  ${slug}: removed a paragraph that just repeated the page title`)
    }

    console.log(
      `  ${slug}: ${matched} documents, ${finalChildren.length} paragraphs kept`,
    )
    pagesChanged++

    if (DRY) continue

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'en',
      data: {
        // A re-run that only stripped a heading must not wipe the attachments.
        ...(attached.length > 0 ? { documents: attached } : {}),
        content: {
          ...(content ?? {}),
          root: { ...content!.root!, children: finalChildren },
        },
      } as never,
      context: { disableRevalidate: true },
    })
  }

  console.log(
    `\n  documents created: ${documentsCreated}   already present: ${documentsExisting}`,
  )
  console.log(`  pages updated: ${pagesChanged}`)

  if (failures.length) {
    console.log(`\n  could not fetch (their paragraphs were left in place):`)
    for (const line of failures) console.log(`    ${line}`)
  }

  // Where the files landed, so the storage move at cutover does not miss them.
  if (!DRY && documentsCreated > 0) {
    const dir = path.resolve('documents')
    const files = await fs.readdir(dir).catch(() => [])
    console.log(`\n  ${files.length} files now in ./documents/`)
  }

  if (DRY) console.log('\nDry run. Re-run without DOCUMENTS_DRY=1 to apply.')
  process.exit(0)
}

await main()
