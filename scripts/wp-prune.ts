/**
 * Removes imported pages that the CURRENT classification no longer wants.
 *
 * Earlier runs used looser rules and brought across test pages and Elementor
 * templates. This reconciles the database with the plan.
 *
 * Lists what it will do first; set WP_PRUNE_APPLY=1 to actually delete.
 * Deletes by explicit id -- never by a pattern.
 */
import fs from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '@payload-config'
import { classify } from './wp-classify.mjs'

const APPLY = process.env.WP_PRUNE_APPLY === '1'

const payload = await getPayload({ config })

const wpPages = JSON.parse(await fs.readFile('.migration/pages.json', 'utf8'))
const wpPosts = JSON.parse(await fs.readFile('.migration/posts.json', 'utf8'))

/**
 * WordPress ids the current rules say belong in each collection. Anything in
 * the database carrying a legacy id that is no longer wanted is an orphan from
 * an earlier, looser pass -- test pages, Elementor templates, and the
 * near-duplicate copies that are now redirects.
 */
const wantedByCollection: Record<'pages' | 'clergy', Set<number>> = {
  pages: new Set(),
  clergy: new Set(),
}

for (const [list, type] of [
  [wpPages, 'pages'],
  [wpPosts, 'posts'],
] as const) {
  for (const record of list) {
    const { category } = classify(record, type)
    if (category === 'page' || category === 'page:stub') {
      wantedByCollection.pages.add(record.id)
    } else if (category === 'clergy') {
      wantedByCollection.clergy.add(record.id)
    }
  }
}

let total = 0

for (const collection of ['pages', 'clergy'] as const) {
  const wanted = wantedByCollection[collection]
  const existing = await payload.find({ collection, limit: 1000, depth: 0 })

  const orphans = existing.docs.filter((doc) => {
    const wpId = doc.legacy?.wpId
    // Leave hand-made and seeded records (no legacy id) alone.
    return typeof wpId === 'number' && !wanted.has(wpId)
  })

  console.log(
    `${collection}: ${existing.docs.length} in database, ${wanted.size} wanted, ${orphans.length} orphaned`,
  )

  for (const doc of orphans) {
    console.log(
      `  ${APPLY ? 'deleting' : 'would delete'} ${collection} id=${doc.id} wpId=${doc.legacy?.wpId} ${doc.slug}`,
    )
    if (APPLY) {
      await payload.delete({
        collection,
        id: doc.id,
        context: { disableRevalidate: true },
      })
    }
  }

  total += orphans.length
}

console.log(`
total orphans: ${total}`)

if (!APPLY) console.log('\nDry run. Re-run with WP_PRUNE_APPLY=1 to apply.')
process.exit(0)
