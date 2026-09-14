/**
 * Applies the 2026 appointments letter to the clergy records.
 *
 * Source: scripts/data/appointments-2026.json — transcribed from a scanned PDF,
 * so everything written here is flagged for review.
 *
 * What it sets
 * ------------
 *  - `currentAssignment` — "Parish Priest, Adyar", "Assistant Parish Priest,
 *    Egmore", or the special-ministry role. This replaces the generic
 *    "Diocesan Parish Priest" text scraped from the old profile pages.
 *  - `status` — retired, on leave, or away (higher studies) where the letter
 *    says so.
 *
 * What it creates
 * ---------------
 * A clergy record for every named priest the letter mentions who is not already
 * in the directory. The old website only published profiles for priests A–H, so
 * roughly two thirds of the presbyterate was missing. Created records carry only
 * what the letter states — name, assignment, status — and are flagged.
 *
 * Appointments that name a religious congregation rather than a priest (SCJ,
 * SDM, MMI, IVD, Guanellian, "Religious") are skipped.
 *
 * Run with:  npm run appointments:apply
 *            APPOINTMENTS_DRY=1 npm run appointments:apply
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

import { findNearMatch, nameKey, slugify, stripHonorific } from './lib/names'

const DRY = process.env.APPOINTMENTS_DRY === '1'

type Entry = { place?: string; role?: string; priest: string; congregation?: boolean }
type Study = { priest: string; study: string }

type Letter = {
  source: Record<string, string>
  parishPriests: Entry[]
  assistantParishPriests: Entry[]
  specialMinistries: Entry[]
  higherStudies: Study[]
  onLeave: string[]
  retirement: string[]
}

type Status = 'active' | 'retired' | 'away' | 'onLeave' | 'deceased'

const main = async () => {
  const raw = await fs.readFile(
    path.resolve('scripts/data/appointments-2026.json'),
    'utf8',
  )
  const letter = JSON.parse(raw) as Letter
  const payload = await getPayload({ config })

  console.log(`Source: ${letter.source.reference} (${letter.source.dated})\n`)

  /** name key -> what the letter says about that priest */
  type Planned = { displayName: string; assignments: string[]; status: Status }
  const planned = new Map<string, Planned>()

  const add = (priestName: string, assignment: string | null, status: Status) => {
    const key = nameKey(priestName)
    if (!key) return

    const existing = planned.get(key)
    if (existing) {
      if (assignment && !existing.assignments.includes(assignment)) {
        existing.assignments.push(assignment)
      }
      // A named status beats the default "active".
      if (status !== 'active') existing.status = status
      return
    }

    planned.set(key, {
      displayName: stripHonorific(priestName),
      assignments: assignment ? [assignment] : [],
      status,
    })
  }

  let skippedCongregations = 0

  for (const entry of letter.parishPriests) {
    if (entry.congregation) { skippedCongregations++; continue }
    add(entry.priest, `Parish Priest, ${entry.place}`, 'active')
  }
  for (const entry of letter.assistantParishPriests) {
    if (entry.congregation) { skippedCongregations++; continue }
    add(entry.priest, `Assistant Parish Priest, ${entry.place}`, 'active')
  }
  for (const entry of letter.specialMinistries) {
    add(entry.priest, entry.role ?? null, 'active')
  }
  for (const entry of letter.higherStudies) {
    add(entry.priest, `Higher studies — ${entry.study}`, 'away')
  }
  for (const name of letter.onLeave) add(name, 'On leave', 'onLeave')
  for (const name of letter.retirement) add(name, null, 'retired')

  console.log(
    `${planned.size} named priests in the letter (${skippedCongregations} appointments name a congregation and are skipped)\n`,
  )

  // ---- Index the existing directory -------------------------------------
  const existing = await payload.find({ collection: 'clergy', limit: 1000, depth: 0 })
  const byName = new Map(existing.docs.map((doc) => [nameKey(doc.name), doc]))
  const usedSlugs = new Set(existing.docs.map((doc) => doc.slug))

  const NOTE =
    'Assignment and status from the 2026 appointments letter (ADMM/ASN/01/2026), transcribed from a scanned PDF — please check against the original.'

  let updated = 0
  let created = 0
  const createdNames: string[] = []
  const ambiguous: string[] = []

  for (const [key, plan] of planned) {
    const assignment = plan.assignments.join('; ') || null
    const doc = byName.get(key)

    if (doc) {
      if (!DRY) {
        await payload.update({
          collection: 'clergy',
          id: doc.id,
          data: {
            currentAssignment: assignment,
            status: plan.status,
            legacy: {
              ...(doc.legacy ?? {}),
              needsReview: true,
              reviewNote: [doc.legacy?.reviewNote, NOTE].filter(Boolean).join(' '),
            },
          } as never,
          context: { disableRevalidate: true },
        })
      }
      updated++
      continue
    }

    // Before creating, check this is not an existing priest spelled differently.
    const near = findNearMatch(key, byName)
    if (near) {
      ambiguous.push(`${plan.displayName}  ~  existing "${near.name}"`)
      continue
    }

    // Not in the directory: the old site only published profiles for A–H.
    let slug = slugify(plan.displayName)
    let suffix = 2
    while (usedSlugs.has(slug)) slug = `${slugify(plan.displayName)}-${suffix++}`
    usedSlugs.add(slug)

    if (!DRY) {
      await payload.create({
        collection: 'clergy',
        data: {
          honorific: 'fr',
          name: plan.displayName,
          slug,
          status: plan.status,
          currentAssignment: assignment,
          contactPublic: false,
          _status: 'published',
          legacy: {
            wpId: null,
            url: letter.source.url,
            needsReview: true,
            reviewNote: `Created from the 2026 appointments letter (${letter.source.reference}); the previous website published no profile for this priest. Name transcribed from a scanned PDF — please verify. ${NOTE}`,
          },
        } as never,
        context: { disableRevalidate: true },
      })
    }
    created++
    createdNames.push(`${plan.displayName} — ${assignment ?? plan.status}`)
  }

  console.log(`  updated existing records: ${updated}`)
  console.log(`  created new records:      ${created}`)
  console.log(`  skipped as possible duplicates: ${ambiguous.length}`)

  if (ambiguous.length) {
    console.log('\n  NOT created -- look the same as an existing record:')
    for (const line of ambiguous) console.log(`    ${line}`)
  }

  if (createdNames.length) {
    console.log('\n  new records:')
    for (const name of createdNames.slice(0, 12)) console.log(`    ${name}`)
    if (createdNames.length > 12) console.log(`    ... and ${createdNames.length - 12} more`)
  }

  // Anyone in the directory the letter does not mention keeps whatever the old
  // profile page said; that is not an error, just not covered by this letter.
  const untouched = existing.docs.filter((doc) => !planned.has(nameKey(doc.name)))
  console.log(
    `\n  ${untouched.length} existing records are not named in the letter and were left alone`,
  )

  if (DRY) console.log('\nDry run. Re-run without APPOINTMENTS_DRY=1 to apply.')
  process.exit(0)
}

await main()
