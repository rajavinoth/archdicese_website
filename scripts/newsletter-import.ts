/**
 * Brings the archdiocesan newsletter — *Niraivalvu* — onto this site.
 *
 * The problem
 * -----------
 * /news-letter-2 came across from WordPress as the wreckage of a tabbed
 * widget: eight year labels stranded in a list, then 86 links in a row. Every
 * one of those links points into the old site's uploads folder, so seven years
 * of the archdiocese's newsletter live on a server that is going to be
 * switched off. Nothing on this site holds a copy.
 *
 * What this does
 * --------------
 * Reads the migrated page, works out which month each link is for, downloads
 * the issues for the years asked for, and stores them in the Documents
 * collection with `category: 'newsletter'` and an `issueDate`. The newsletter
 * page then queries that collection and groups by year, so adding next month's
 * issue is an upload in the admin rather than an edit to a page.
 *
 * The migrated page's content is left exactly as it is — it is still the only
 * record of the years not yet taken over — but it is unpublished once the
 * import succeeds, so visitors get the new archive instead of a wall of links
 * to a server that is going away. Scripts read it through the Local API, which
 * does not apply access control, so unpublishing does not stop a later run.
 *
 * Run with:
 *   npm run newsletter:import              current and previous calendar year
 *   NEWSLETTER_YEARS=2024,2023 npm run newsletter:import
 *   NEWSLETTER_DRY=1 npm run newsletter:import
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.NEWSLETTER_DRY === '1'

const PAGE_SLUG = 'news-letter-2'

/**
 * Which years to take over. The default is this year and last year, which is
 * what the archdiocese asked for: the current run of issues, plus the one
 * people still refer back to.
 */
const yearsWanted = (): number[] => {
  const override = process.env.NEWSLETTER_YEARS
  if (override) {
    return override
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((year) => Number.isInteger(year) && year > 1990)
  }
  const thisYear = new Date().getUTCFullYear()
  return [thisYear, thisYear - 1]
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Month names in Tamil, so the archive reads properly in both languages. */
const MONTHS_TA = [
  'ஜனவரி',
  'பிப்ரவரி',
  'மார்ச்',
  'ஏப்ரல்',
  'மே',
  'ஜூன்',
  'ஜூலை',
  'ஆகஸ்ட்',
  'செப்டம்பர்',
  'அக்டோபர்',
  'நவம்பர்',
  'டிசம்பர்',
]

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  fields?: { url?: string; [key: string]: unknown }
  [key: string]: unknown
}

const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/** Every link on the page, in the order it appears. */
const linksIn = (
  node: LexicalNode,
  found: { label: string; url: string }[] = [],
): { label: string; url: string }[] => {
  if (node.type === 'link' || node.type === 'autolink') {
    const url = typeof node.fields?.url === 'string' ? node.fields.url : null
    if (url) found.push({ label: textOf(node).trim(), url })
  }
  for (const child of node.children ?? []) linksIn(child, found)
  return found
}

/**
 * "Jan 2026" -> January 2026.
 *
 * Letters and digits are read separately rather than with one tidy pattern,
 * because the old page contains "May2 019" — a stray space inside the year.
 * Taking the first run of letters as the month and every digit in the label as
 * the year reads that correctly, and reads the well-formed labels the same way.
 */
const monthFrom = (label: string): { year: number; month: number } | null => {
  const letters = label.match(/[A-Za-z]+/)?.[0]?.toLowerCase()
  const digits = label.replace(/\D/g, '')
  if (!letters || digits.length !== 4) return null

  const month = MONTHS.findIndex((name) =>
    name.toLowerCase().startsWith(letters.slice(0, 3)),
  )
  if (month < 0) return null

  const year = Number(digits)
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null

  return { year, month }
}

const main = async () => {
  const payload = await getPayload({ config })
  const years = yearsWanted()

  console.log(`  years: ${years.join(', ')}\n`)

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
    locale: 'en',
    // The page is unpublished at the end of a successful run; a second run
    // still has to be able to read it.
    draft: true,
  })

  const page = result.docs[0]
  if (!page) {
    console.log(`  no page with slug "${PAGE_SLUG}" — nothing to read`)
    process.exit(1)
  }

  const content = page.content as { root?: LexicalNode } | null | undefined
  if (!content?.root) {
    console.log('  the page has no content')
    process.exit(1)
  }

  const links = linksIn(content.root)

  const issues: { year: number; month: number; url: string; label: string }[] = []
  const unreadable: string[] = []

  for (const link of links) {
    const when = monthFrom(link.label)
    if (!when) {
      // The old page also carries a link to the tab plugin's own website.
      unreadable.push(`${link.label || '(no label)'} -> ${link.url}`)
      continue
    }
    issues.push({ ...when, url: link.url, label: link.label })
  }

  console.log(`  ${links.length} links on the page, ${issues.length} read as issues`)
  if (unreadable.length) {
    console.log(`  not an issue, skipped:`)
    for (const line of unreadable) console.log(`    ${line}`)
  }

  const byYear = new Map<number, number>()
  for (const issue of issues) byYear.set(issue.year, (byYear.get(issue.year) ?? 0) + 1)
  console.log(
    `  issues per year: ${[...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, count]) => `${year}: ${count}`)
      .join('   ')}\n`,
  )

  const wanted = issues
    .filter((issue) => years.includes(issue.year))
    .sort((a, b) => b.year - a.year || b.month - a.month)

  let created = 0
  let existing = 0
  const failures: string[] = []

  for (const issue of wanted) {
    const title = `${MONTHS[issue.month]} ${issue.year}`

    const already = await payload.find({
      collection: 'documents',
      where: { 'legacy.url': { equals: issue.url } },
      limit: 1,
      depth: 0,
    })

    if (already.docs.length > 0) {
      existing++
      continue
    }

    const filename = decodeURIComponent(issue.url.split('/').pop() ?? '').split('?')[0]

    if (DRY) {
      console.log(`  would fetch: ${title}  <-  ${filename}`)
      created++
      continue
    }

    try {
      const response = await fetch(issue.url, {
        headers: { 'User-Agent': 'ADMM-website-migration/1.0' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength === 0) throw new Error('empty file')

      /**
       * A WordPress site that has lost a file often answers with a styled
       * "not found" page and a 200, which would otherwise be filed away as a
       * newsletter and only discovered by a reader clicking it. Every PDF
       * starts with these four bytes.
       */
      if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
        throw new Error('not a PDF (the server sent something else)')
      }

      const document = await payload.create({
        collection: 'documents',
        locale: 'en',
        data: {
          title,
          category: 'newsletter',
          // Midday UTC on the first: see the field's comment in Documents.ts.
          issueDate: new Date(Date.UTC(issue.year, issue.month, 1, 12)).toISOString(),
          legacy: {
            wpId: null,
            url: issue.url,
            needsReview: false,
            reviewNote: null,
          },
        } as never,
        file: {
          data: buffer,
          name: filename,
          mimetype: 'application/pdf',
          size: buffer.byteLength,
        },
        context: { disableRevalidate: true },
      })

      // The Tamil title is written separately: a create() writes one locale.
      await payload.update({
        collection: 'documents',
        id: document.id,
        locale: 'ta',
        data: { title: `${MONTHS_TA[issue.month]} ${issue.year}` } as never,
        context: { disableRevalidate: true },
      })

      created++
      console.log(`  + ${title}  (${Math.round(buffer.byteLength / 1024)} KB)`)
    } catch (error) {
      failures.push(`${title} — ${(error as Error).message}\n      ${issue.url}`)
    }
  }

  console.log(`\n  downloaded: ${created}   already held: ${existing}`)

  const missing = years.flatMap((year) => {
    const have = new Set(
      issues.filter((issue) => issue.year === year).map((issue) => issue.month),
    )
    return MONTHS.filter((_, month) => !have.has(month)).map((name) => `${name} ${year}`)
  })

  /**
   * Worth printing rather than passing over in silence: the archdiocese may
   * simply not have published in those months, or the link may have been lost
   * when the old page was edited. Only they can tell the two apart.
   */
  if (missing.length) {
    console.log(`\n  no issue on the old page for:`)
    console.log(`    ${missing.join(', ')}`)
  }

  if (failures.length) {
    console.log(`\n  could not fetch:`)
    for (const line of failures) console.log(`    ${line}`)
  }

  /**
   * Retire the migrated page. /newsletter now does its job properly, and
   * leaving this published would mean two newsletter pages, one of them a wall
   * of links into a server that is being switched off. The content stays in
   * the admin as a draft: it is the only remaining record of the years not yet
   * downloaded.
   */
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
            'Superseded by /newsletter. Kept as a draft because it still holds the links to the issues not yet downloaded.',
        },
      } as never,
      context: { disableRevalidate: true },
    })
    console.log(`\n  unpublished /${PAGE_SLUG} — superseded by /newsletter`)
  }

  if (DRY) console.log('\nDry run. Re-run without NEWSLETTER_DRY=1 to apply.')
  process.exit(0)
}

await main()
