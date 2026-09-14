/**
 * Step 2 of the migration: a DRY RUN over the cached WordPress content.
 *
 * Prints what the import would create, skip, and flag for review, and writes
 * the full breakdown plus the 301 redirect map to .migration/. Nothing is
 * written to the database.
 *
 * Run with:  npm run wp:report
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  CATEGORY,
  DUPLICATE_OF,
  classify,
  cleanSlug,
  plainText,
} from './wp-classify.mjs'

const OUT = path.resolve('.migration')
const SITE = 'https://archdioceseofmadrasmylapore.in'

const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(OUT, `${name}.json`), 'utf8'))

const main = async () => {
  const [pages, posts, media] = await Promise.all([
    read('pages'),
    read('posts'),
    read('media'),
  ])

  // Events are scraped separately; they only matter here for the redirect map.
  let events = []
  try {
    events = await read('events')
  } catch {
    console.log('(no events cache yet -- run npm run wp:fetch-events)')
  }

  const rows = [
    ...pages.map((record) => ({ record, type: 'pages' })),
    ...posts.map((record) => ({ record, type: 'posts' })),
  ].map(({ record, type }) => {
    const { category, reason } = classify(record, type)
    return {
      wpId: record.id,
      type,
      slug: record.slug,
      cleanSlug: cleanSlug(record.slug),
      title: plainText(record.title?.rendered) || '(untitled)',
      url: record.link ?? `${SITE}/${record.slug}/`,
      chars: plainText(record.content?.rendered).length,
      featuredMedia: record.featured_media || null,
      category,
      reason,
    }
  })

  // ---- Summary -----------------------------------------------------------
  const byCategory = new Map()
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, [])
    byCategory.get(row.category).push(row)
  }

  const order = [
    CATEGORY.CLERGY,
    CATEGORY.PARISH,
    CATEGORY.PAGE,
    CATEGORY.PAGE_STUB,
    CATEGORY.POST,
    CATEGORY.SKIP_GENERATED,
    CATEGORY.SKIP_DUPLICATE,
    CATEGORY.SKIP_INFRA,
    CATEGORY.SKIP_JUNK,
  ]

  console.log(`\nSource: ${pages.length} pages + ${posts.length} posts = ${rows.length} records`)
  console.log(`Media records cached: ${media.length}\n`)

  console.log('WILL IMPORT')
  for (const category of order.filter((c) => !c.startsWith('skip'))) {
    const list = byCategory.get(category) ?? []
    console.log(`  ${category.padEnd(12)} ${String(list.length).padStart(4)}`)
  }

  console.log('\nWILL SKIP')
  for (const category of order.filter((c) => c.startsWith('skip'))) {
    const list = byCategory.get(category) ?? []
    if (list.length === 0) continue
    console.log(`  ${category.padEnd(42)} ${String(list.length).padStart(4)}`)
  }

  // ---- Detail for the skipped, so nothing vanishes unexamined -------------
  console.log('\nSkipped in detail:')
  for (const category of order.filter((c) => c.startsWith('skip'))) {
    const list = byCategory.get(category) ?? []
    if (list.length === 0) continue
    console.log(`\n  ${category}`)
    for (const row of list) {
      console.log(`    ${String(row.wpId).padEnd(7)} ${row.slug.slice(0, 44).padEnd(46)} ${row.reason}`)
    }
  }

  // ---- Redirect map ------------------------------------------------------
  const target = (row) => {
    switch (row.category) {
      case CATEGORY.CLERGY:
        return `/clergy/${cleanSlug(row.slug.replace(/^(fr|rev|msgr|most-rev)-/, ''))}`
      case CATEGORY.PARISH:
        return `/parishes/${row.cleanSlug}`
      case CATEGORY.POST:
        return `/news/${row.cleanSlug}`
      case CATEGORY.PAGE:
      case CATEGORY.PAGE_STUB:
        // The old Contact Us page's details now live on the built /contact
        // page, so send that URL there rather than to a migrated duplicate.
        if (row.cleanSlug === 'contact-us') return '/contact'
        return `/${row.cleanSlug}`
      case CATEGORY.SKIP_DUPLICATE: {
        // Point the redundant copy at whichever URL now serves the content.
        const canonical = DUPLICATE_OF[row.slug]
        if (!canonical) return '/'
        return canonical.startsWith('fr-')
          ? `/clergy/${cleanSlug(canonical.replace(/^(fr|rev|msgr|most-rev)-/, ''))}`
          : `/${cleanSlug(canonical)}`
      }
      case CATEGORY.SKIP_GENERATED:
        // Point listing pages at the generated equivalents.
        if (/^(parish|shrine|church|our-church)/.test(row.cleanSlug)) return '/parishes'
        if (/^(priest|clergy)/.test(row.cleanSlug)) return '/clergy'
        if (/^(event|calendar)/.test(row.cleanSlug)) return '/events'
        return '/'
      default:
        return null // deliberately dropped; will 404 or go to /
    }
  }

  const trim = (value) => value.replace(/\/+$/, '') || '/'

  const redirects = rows
    .map((row) => {
      const to = target(row)
      if (!to) return null
      const from = new URL(row.url).pathname
      // A redirect that only adds or removes a trailing slash is pointless --
      // Next.js normalises that itself, and shipping it risks a loop.
      if (trim(from) === trim(to)) return null
      return { from, to, wpId: row.wpId }
    })
    .filter(Boolean)

  /**
   * Event URLs were singular on the old site (/event/foo) and are plural here
   * (/events/foo), so every one of them needs a redirect.
   */
  for (const event of events) {
    if (!event.slug || !event.start) continue

    // Test entries are not imported, so send them to the listing rather than
    // to a page that will 404.
    const isTest = event.slug === 'test' || /^test\b/i.test(event.title ?? '')

    const from = `/event/${event.slug}`
    const to = isTest ? '/events' : `/events/${cleanSlug(event.slug)}`
    if (trim(from) !== trim(to)) redirects.push({ from, to, wpId: null })
  }

  const dropped = rows.filter((row) => !target(row))

  await fs.writeFile(
    path.join(OUT, '_plan.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
    'utf8',
  )
  await fs.writeFile(
    path.join(OUT, '_redirects.json'),
    JSON.stringify(redirects, null, 2),
    'utf8',
  )

  /**
   * Also write a committed file that next.config.ts reads, so the 301s ship
   * with the app. The .migration copy is a working artefact; this one is the
   * deliverable.
   */
  await fs.writeFile(
    path.resolve('redirects.generated.json'),
    JSON.stringify(
      // Sources must NOT carry a trailing slash: Next.js normalises the
      // trailing slash before matching redirects, so "/fr-x/" never matches
      // and only the normalisation 308 fires.
      redirects.map(({ from, to }) => ({
        source: trim(from),
        destination: to,
        permanent: true,
      })),
      null,
      2,
    ) + '\n',
    'utf8',
  )

  console.log(`\n--- Redirects ---`)
  console.log(`  ${redirects.length} old URLs mapped (including ${events.length} events)`)
  console.log(`  ${dropped.length} intentionally dropped (plugin pages and junk)`)
  console.log(`\nWrote .migration/_plan.json and .migration/_redirects.json`)
  console.log('Next: npm run wp:import')
}

await main()
