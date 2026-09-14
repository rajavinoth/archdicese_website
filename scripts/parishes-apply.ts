/**
 * Creates a parish record for every place named in the 2026 appointments
 * letter, and links its priests.
 *
 * Where the data comes from
 * -------------------------
 * Only the letter (scripts/data/appointments-2026.json). It names 53 places and
 * who serves them, which is enough to create the parishes and turn the
 * assignment text on clergy pages into real links.
 *
 * Where it deliberately does NOT come from
 * ----------------------------------------
 * The old clergy profiles carry postal addresses, and it is tempting to mine
 * them for church names. Two things stop that:
 *
 *  1. They are stale. Fr Antony Doss's address is a church in Villivakkam while
 *     the 2026 letter posts him to Chintadripet — he moved, so an address does
 *     not identify his current parish.
 *  2. Matching a place name inside an address is unsafe. "Avadi" matched a
 *     Villivakkam address because the street is "Oth-avadi" Street. Six
 *     candidates came out of that approach and at least one was provably wrong,
 *     so none are used.
 *
 * So a parish is named after its place, which is accurate but provisional — the
 * dedication ("St Antony's Church") has to come from the curia. The three
 * dedications the letter does give, as "Place - Dedication", are kept in
 * `patron`.
 *
 * Addresses, coordinates and mass timings are left empty rather than invented.
 * Publishing a wrong mass time is the most harmful thing this site could do.
 *
 * Run with:  npm run parishes:apply
 *            PARISHES_DRY=1 npm run parishes:apply
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

import { nameKey, slugify } from './lib/names'

const DRY = process.env.PARISHES_DRY === '1'

type Entry = { place: string; priest: string; congregation?: boolean }
type Letter = {
  source: Record<string, string>
  parishPriests: Entry[]
  assistantParishPriests: Entry[]
}

/**
 * Places in the letter that are an existing parish under another name.
 * Santhome is the seat of the cathedral, which is already in the database.
 */
const ALIASES: Record<string, string> = {
  santhome: 'san-thome-cathedral-basilica',
}

/** "Vepery - St Joseph's" -> { place: 'Vepery', patron: "St Joseph's" } */
const splitPlace = (raw: string): { place: string; patron: string | null } => {
  const match = /^(.*?)\s+[-–]\s+(.*)$/.exec(raw.trim())
  if (!match) return { place: raw.trim(), patron: null }
  return { place: match[1].trim(), patron: match[2].trim() }
}

const main = async () => {
  const raw = await fs.readFile(
    path.resolve('scripts/data/appointments-2026.json'),
    'utf8',
  )
  const letter = JSON.parse(raw) as Letter
  const payload = await getPayload({ config })

  console.log(`Source: ${letter.source.reference} (${letter.source.dated})\n`)

  // ---- Gather the places and who serves them -----------------------------
  type Plan = {
    place: string
    patron: string | null
    priestNames: string[]
    assistantNames: string[]
  }
  const plans = new Map<string, Plan>()

  const planFor = (rawPlace: string): Plan => {
    const { place, patron } = splitPlace(rawPlace)
    const slug = slugify(place)
    let plan = plans.get(slug)
    if (!plan) {
      plan = { place, patron, priestNames: [], assistantNames: [] }
      plans.set(slug, plan)
    }
    // Keep a dedication if any of this place's entries supplies one.
    if (patron && !plan.patron) plan.patron = patron
    return plan
  }

  for (const entry of letter.parishPriests) {
    const plan = planFor(entry.place)
    if (!entry.congregation) plan.priestNames.push(entry.priest)
  }
  for (const entry of letter.assistantParishPriests) {
    const plan = planFor(entry.place)
    if (!entry.congregation) plan.assistantNames.push(entry.priest)
  }

  console.log(`${plans.size} distinct places named in the letter`)

  // ---- Index clergy so the links can be made -----------------------------
  const clergy = await payload.find({ collection: 'clergy', limit: 1000, depth: 0 })
  const clergyByName = new Map(clergy.docs.map((doc) => [nameKey(doc.name), doc.id]))

  const linkFor = (names: string[]) =>
    names.map((name) => clergyByName.get(nameKey(name))).filter((id) => id != null)

  const NOTE =
    'Created from the 2026 appointments letter (ADMM/ASN/01/2026). The name is the place, not the church’s dedication — please supply the proper parish name, address, coordinates and mass timings. Nothing here is invented.'

  let created = 0
  let updated = 0
  let unlinked = 0

  for (const [slug, plan] of plans) {
    const targetSlug = ALIASES[slug] ?? slug

    const priestIds = linkFor(plan.priestNames)
    const assistantIds = linkFor(plan.assistantNames)
    unlinked +=
      plan.priestNames.length -
      priestIds.length +
      (plan.assistantNames.length - assistantIds.length)

    const existing = await payload.find({
      collection: 'parishes',
      where: { slug: { equals: targetSlug } },
      limit: 1,
      depth: 0,
    })

    const isAlias = targetSlug !== slug

    const data: Record<string, unknown> = {
      // An aliased parish keeps the name it already has.
      ...(existing.docs.length || isAlias ? {} : { name: plan.place }),
      slug: targetSlug,
      ...(plan.patron ? { patron: plan.patron } : {}),
      parishPriest: priestIds[0] ?? null,
      assistantPriests: assistantIds,
      _status: 'published',
      legacy: {
        wpId: null,
        url: letter.source.url,
        needsReview: true,
        reviewNote: NOTE,
      },
    }

    if (DRY) {
      if (existing.docs.length) updated++
      else created++
      continue
    }

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'parishes',
        id: existing.docs[0].id,
        data: data as never,
        context: { disableRevalidate: true },
      })
      updated++
    } else {
      await payload.create({
        collection: 'parishes',
        data: { ...data, name: plan.place } as never,
        context: { disableRevalidate: true },
      })
      created++
    }
  }

  console.log(`  created: ${created}   updated: ${updated}`)
  console.log(`  priest names in the letter with no clergy record: ${unlinked}`)

  // ---- Remove the seeded placeholder timings and coordinates -------------
  /**
   * The seed invented mass timings and latitude/longitude for four parishes to
   * exercise the finder. Invented mass times are the most harmful thing this
   * site could publish -- somebody could arrive for a mass that does not exist
   * -- so they go, the same way the fabricated deaneries did. The finder itself
   * is built and tested; it fills in as soon as real timings are entered.
   */
  const seeded = await payload.find({ collection: 'parishes', limit: 1000, depth: 0 })
  const letterSlugs = new Set([...plans.keys()].map((slug) => ALIASES[slug] ?? slug))

  let cleaned = 0
  let unpriested = 0

  for (const parish of seeded.docs) {
    const hasPlaceholderData =
      (parish.services?.length ?? 0) > 0 || parish.latitude != null || parish.longitude != null

    /**
     * The seed also handed each of its four parishes a parish priest
     * round-robin. For any parish the letter does not name, that link is
     * fabricated and goes too.
     */
    const hasFabricatedPriest =
      !letterSlugs.has(parish.slug) &&
      (parish.parishPriest != null || (parish.assistantPriests?.length ?? 0) > 0)

    if (!hasPlaceholderData && !hasFabricatedPriest) continue
    if (hasPlaceholderData) cleaned++
    if (hasFabricatedPriest) unpriested++
    if (DRY) continue

    const notes = [
      parish.legacy?.reviewNote,
      hasPlaceholderData
        ? 'Placeholder mass timings and map coordinates were removed — they were invented by the development seed, never real.'
        : null,
      hasFabricatedPriest
        ? 'The parish priest link was removed: the seed assigned one at random, and this parish is not named in the 2026 appointments letter.'
        : null,
    ].filter(Boolean)

    await payload.update({
      collection: 'parishes',
      id: parish.id,
      data: {
        ...(hasPlaceholderData ? { services: [], latitude: null, longitude: null } : {}),
        ...(hasFabricatedPriest ? { parishPriest: null, assistantPriests: [] } : {}),
        legacy: {
          ...(parish.legacy ?? {}),
          needsReview: true,
          reviewNote: notes.join(' '),
        },
      } as never,
      context: { disableRevalidate: true },
    })
  }

  console.log(`  parishes cleared of placeholder timings/coordinates: ${cleaned}`)
  console.log(`  parishes cleared of a fabricated parish priest: ${unpriested}`)

  // ---- Tidy the names that came across from WordPress --------------------
  /**
   * Two artefacts from the old site's page titles:
   *
   *  - "St Mark's Catholic Church . . ." — trailing filler dots.
   *  - "St. Louis Church புனித லூயிஸ் ஆலயம்" — the Tamil name crammed into the
   *    same field. Now that `name` is localized, the Tamil belongs in the `ta`
   *    locale and the English field should hold only English.
   */
  let tidied = 0

  for (const parish of seeded.docs) {
    const original = String(parish.name ?? '')

    const withoutFiller = original.replace(/[\s.]*(\.\s*){2,}$/, '').trim()
    const tamil = withoutFiller.match(/[஀-௿][஀-௿\s]*$/)?.[0]?.trim() ?? null
    const english = tamil ? withoutFiller.slice(0, withoutFiller.length - tamil.length).trim() : withoutFiller

    if (english === original && !tamil) continue
    tidied++
    if (DRY) continue

    await payload.update({
      collection: 'parishes',
      id: parish.id,
      locale: 'en',
      data: { name: english } as never,
      context: { disableRevalidate: true },
    })

    if (tamil) {
      await payload.update({
        collection: 'parishes',
        id: parish.id,
        locale: 'ta',
        data: { name: tamil } as never,
        context: { disableRevalidate: true },
      })
    }

    console.log(`  tidied "${original}" -> "${english}"${tamil ? ` (ta: "${tamil}")` : ''}`)
  }

  console.log(`  parish names tidied: ${tidied}`)

  const total = await payload.count({ collection: 'parishes' })
  console.log(`\n  parishes now: ${DRY ? `${plans.size} (target)` : total.totalDocs}`)

  if (DRY) console.log('\nDry run. Re-run without PARISHES_DRY=1 to apply.')
  process.exit(0)
}

await main()
