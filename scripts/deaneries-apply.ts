/**
 * Replaces the seeded placeholder deaneries with the real ones, and removes the
 * fabricated deanery assignments from clergy and parishes.
 *
 * Why this exists
 * ---------------
 * The seed invented three deaneries (taken from three near-empty blog posts on
 * the old site) and then assigned every priest and parish to one of them
 * round-robin. That data looked authoritative on a diocesan website while being
 * entirely made up, which is worse than showing nothing.
 *
 * The 2026 appointments letter (see scripts/data/deaneries-2026.json) settles
 * the deaneries themselves: there are SIX, not three, and "Our Lady of Lourdes"
 * — one of the seeded three — is not among them.
 *
 * What it does NOT do
 * -------------------
 * It does not assign priests or parishes to deaneries. The letter gives
 * parish -> priest and deanery -> dean + seat, but no parish -> deanery
 * mapping, so a priest's deanery is not derivable from any source we have.
 * Those fields are cleared and flagged rather than guessed.
 *
 * Run with:  npm run deaneries:apply
 *            DEANERIES_DRY=1 npm run deaneries:apply   (report only)
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.DEANERIES_DRY === '1'

type Source = {
  source: Record<string, string>
  deaneries: {
    name: string
    slug: string
    seat: string
    deanName: string
  }[]
}

/**
 * Names are written differently in the two sources: the letter says
 * "Rev Fr E Arulappa", our records say "Arulappa E". Compare on the set of
 * word-ish tokens so word order and honorifics stop mattering.
 */
const nameKey = (input: string): string =>
  input
    .toLowerCase()
    .replace(/\b(rev|fr|msgr|most|very|dr)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .sort()
    .join(' ')

const main = async () => {
  const raw = await fs.readFile(
    path.resolve('scripts/data/deaneries-2026.json'),
    'utf8',
  )
  const { source, deaneries } = JSON.parse(raw) as Source

  const payload = await getPayload({ config })

  console.log(`Source: ${source.document} (${source.reference}, ${source.dated})`)
  console.log(`${deaneries.length} deaneries in the letter\n`)

  // ---- Index clergy by normalised name, for dean matching ----------------
  const clergy = await payload.find({ collection: 'clergy', limit: 1000, depth: 0 })
  const clergyByName = new Map<string, { id: number | string; name: string }>()
  for (const priest of clergy.docs) {
    clergyByName.set(nameKey(priest.name), { id: priest.id, name: priest.name })
  }

  // ---- Upsert the six real deaneries -------------------------------------
  const keptIds: (number | string)[] = []

  for (const deanery of deaneries) {
    const match = clergyByName.get(nameKey(deanery.deanName))

    const data = {
      name: deanery.name,
      slug: deanery.slug,
      seat: deanery.seat,
      deanName: deanery.deanName,
      dean: match?.id ?? null,
    }

    const existing = await payload.find({
      collection: 'deaneries',
      where: { slug: { equals: deanery.slug } },
      limit: 1,
      depth: 0,
    })

    if (!DRY) {
      if (existing.docs.length > 0) {
        const updated = await payload.update({
          collection: 'deaneries',
          id: existing.docs[0].id,
          data: data as never,
          context: { disableRevalidate: true },
        })
        keptIds.push(updated.id)
      } else {
        const created = await payload.create({
          collection: 'deaneries',
          data: data as never,
          context: { disableRevalidate: true },
        })
        keptIds.push(created.id)
      }
    } else if (existing.docs.length > 0) {
      keptIds.push(existing.docs[0].id)
    }

    console.log(
      `  ${existing.docs.length ? 'updated' : 'created'}  ${deanery.name.padEnd(38)}` +
        ` seat=${deanery.seat.padEnd(14)} dean=${match ? `linked (${match.name})` : 'name only'}`,
    )
  }

  // ---- Remove deaneries that the letter does not list --------------------
  const all = await payload.find({ collection: 'deaneries', limit: 1000, depth: 0 })
  const officialSlugs = new Set(deaneries.map((d) => d.slug))
  const obsolete = all.docs.filter((doc) => !officialSlugs.has(doc.slug))

  if (obsolete.length > 0) {
    console.log(`\n  ${obsolete.length} deanery(ies) not in the 2026 letter:`)
    for (const doc of obsolete) {
      console.log(`    ${DRY ? 'would delete' : 'deleting'} "${doc.name}" (${doc.slug})`)
      if (!DRY) {
        await payload.delete({
          collection: 'deaneries',
          id: doc.id,
          context: { disableRevalidate: true },
        })
      }
    }
  }

  // ---- Clear the fabricated assignments ----------------------------------
  const NOTE =
    'Deanery cleared: the seed had assigned one at random. The 2026 appointments letter names the six deaneries and their deans but does not map individual priests or parishes to them, so this needs the curia’s own records.'

  let clergyCleared = 0
  for (const priest of clergy.docs) {
    if (priest.deanery == null) continue
    clergyCleared++
    if (DRY) continue

    await payload.update({
      collection: 'clergy',
      id: priest.id,
      data: {
        deanery: null,
        legacy: {
          ...(priest.legacy ?? {}),
          needsReview: true,
          reviewNote: [priest.legacy?.reviewNote, NOTE].filter(Boolean).join(' '),
        },
      } as never,
      context: { disableRevalidate: true },
    })
  }

  const parishes = await payload.find({ collection: 'parishes', limit: 1000, depth: 0 })
  let parishesCleared = 0
  for (const parish of parishes.docs) {
    if (parish.deanery == null) continue
    parishesCleared++
    if (DRY) continue

    await payload.update({
      collection: 'parishes',
      id: parish.id,
      data: {
        deanery: null,
        legacy: {
          ...(parish.legacy ?? {}),
          needsReview: true,
          reviewNote: [parish.legacy?.reviewNote, NOTE].filter(Boolean).join(' '),
        },
      } as never,
      context: { disableRevalidate: true },
    })
  }

  console.log(
    `\n  cleared fabricated deanery on ${clergyCleared} clergy and ${parishesCleared} parishes`,
  )
  // In a dry run nothing is written, so report the target rather than a count
  // of pre-existing rows.
  console.log(`  deaneries now: ${DRY ? deaneries.length : keptIds.length}`)

  if (DRY) console.log('\nDry run. Re-run without DEANERIES_DRY=1 to apply.')
  process.exit(0)
}

await main()
