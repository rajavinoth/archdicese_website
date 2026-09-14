/**
 * Reads the filled-in worksheets back out of ./worksheet/ and applies them.
 *
 * Companion to worksheet-export.ts. Whatever the curia sends back goes in
 * through here, so this script is where all the suspicion lives.
 *
 * Principles
 * ----------
 * **A blank cell means "no change", not "delete".** The exported sheets are
 * pre-filled with what the site already holds, so a person scrolling past a
 * row must not wipe it. To clear a value deliberately they type a single dash.
 * Getting this backwards would let one careless save empty the database.
 *
 * **Refuse rather than guess.** Every ambiguous or unrecognised value is
 * reported with its file and row number and then skipped. The rest of the file
 * still applies — one bad cell does not block 55 good rows.
 *
 * **A bare "6:00" is rejected.** It could be the morning mass or the evening
 * one, and sending somebody to church at the wrong hour is the worst thing
 * this website could do. The sheet asks for "6:00 am"; anything that could
 * mean two times is refused, not assumed.
 *
 * **Coordinates outside Tamil Nadu are rejected.** Latitude and longitude are
 * easy to type into the wrong columns, and 80.2 is a perfectly valid latitude
 * — in Siberia. A generous bounding box catches the swap.
 *
 * Run with:  npm run worksheet:import:dry     (report only, changes nothing)
 *            npm run worksheet:import
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

import { parseCsv, type Row } from './lib/csv'
import { nameKey, slugify, stripHonorific } from './lib/names'
import { parseTime } from './lib/time'

const DRY = process.env.WORKSHEET_DRY === '1'
const DIR = path.resolve('worksheet')

/** Typed by a person to mean "clear this field". */
const CLEAR = '-'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const KINDS = ['mass', 'novena', 'adoration', 'confession']
const LANGUAGES = ['tamil', 'english', 'telugu', 'hindi', 'malayalam', 'latin']

/** Tamil Nadu, generously. Anything outside is a data-entry error. */
const BOUNDS = { minLat: 8, maxLat: 14, minLon: 76, maxLon: 81 }

const problems: string[] = []
const notes: string[] = []

const problem = (file: string, row: number, message: string) => {
  // +2: the header line, and 1-based counting, so the number matches what the
  // person sees in their spreadsheet.
  problems.push(`${file} row ${row + 2}: ${message}`)
}

/** Read a worksheet, or return null if the curia has not sent it back. */
const readSheet = async (name: string): Promise<Row[] | null> => {
  try {
    const text = await fs.readFile(path.join(DIR, name), 'utf8')
    return parseCsv(text)
  } catch {
    return null
  }
}

/**
 * Interpret a fillable cell.
 *   ''   -> undefined  (no change)
 *   '-'  -> null       (clear the field)
 *   text -> text
 */
const cell = (value: string | undefined): string | null | undefined => {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return undefined
  if (trimmed === CLEAR) return null
  return trimmed
}

/**
 * Record a field only when the sheet actually changes it.
 *
 * Without this, re-importing an untouched export reports every pre-filled cell
 * as an update, and the operator cannot tell a real edit from the noise — the
 * run should be a clean no-op until somebody types something. `undefined` from
 * `cell()` means the person left the cell blank, so it is skipped entirely;
 * `null` means they asked for it to be cleared, which only counts as a change
 * if there was something there.
 */
const setIfChanged = (
  data: Record<string, unknown>,
  field: string,
  incoming: string | null | undefined,
  current: unknown,
): void => {
  if (incoming === undefined) return

  const normalizedCurrent =
    current === null || current === undefined ? null : String(current)

  if (incoming === normalizedCurrent) return
  data[field] = incoming
}

const parseYesNo = (value: string): boolean | null => {
  const text = value.trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(text)) return true
  if (['no', 'n', 'false', '0'].includes(text)) return false
  return null
}

const main = async () => {
  const payload = await getPayload({ config })

  const [parishSheet, timingSheet, nameSheet, clergySheet] = await Promise.all([
    readSheet('1-parishes.csv'),
    readSheet('2-mass-timings.csv'),
    readSheet('3-priest-name-check.csv'),
    readSheet('4-clergy-deanery.csv'),
  ])

  if (!parishSheet && !timingSheet && !nameSheet && !clergySheet) {
    console.log(
      `No worksheets found in ./worksheet/. Run "npm run worksheet:export" first,\nthen put the files the curia sends back into that folder.`,
    )
    process.exit(1)
  }

  // ---- Lookups ----------------------------------------------------------
  const deaneries = await payload.find({
    collection: 'deaneries',
    limit: 100,
    depth: 0,
    pagination: false,
  })

  /** Deaneries are matched on name or slug, case-insensitively. */
  const deaneryByKey = new Map<string, number | string>()
  for (const deanery of deaneries.docs) {
    deaneryByKey.set(deanery.name.trim().toLowerCase(), deanery.id)
    deaneryByKey.set(deanery.slug.trim().toLowerCase(), deanery.id)
    // "St Jude" as well as "Deanery of St Jude".
    deaneryByKey.set(
      deanery.name.replace(/^deanery of (the )?/i, '').trim().toLowerCase(),
      deanery.id,
    )
  }

  const parishes = await payload.find({
    collection: 'parishes',
    limit: 1000,
    depth: 0,
    pagination: false,
  })
  const parishBySlug = new Map(parishes.docs.map((doc) => [doc.slug, doc]))

  const clergy = await payload.find({
    collection: 'clergy',
    limit: 1000,
    depth: 0,
    pagination: false,
  })
  const clergyBySlug = new Map(clergy.docs.map((doc) => [doc.slug, doc]))

  const resolveDeanery = (
    value: string,
    file: string,
    index: number,
  ): number | string | null | undefined => {
    const parsed = cell(value)
    if (parsed === undefined) return undefined
    if (parsed === null) return null

    const id = deaneryByKey.get(parsed.trim().toLowerCase())
    if (id === undefined) {
      problem(
        file,
        index,
        `deanery "${parsed}" is not one of the six. Use a name from HOW-TO-FILL-THIS-IN.md.`,
      )
      return undefined
    }
    return id
  }

  // ---- 1. Parish details ------------------------------------------------
  /** parish id -> the update payload, merged with the timings below. */
  const parishUpdates = new Map<number | string, Record<string, unknown>>()
  const addressUpdates = new Map<number | string, Record<string, unknown>>()

  if (parishSheet) {
    console.log(`\n1-parishes.csv: ${parishSheet.length} rows`)

    parishSheet.forEach((row, index) => {
      const slug = row.ref_slug?.trim()
      if (!slug) {
        problem('1-parishes.csv', index, 'ref_slug is empty — the row cannot be matched.')
        return
      }

      const parish = parishBySlug.get(slug)
      if (!parish) {
        problem('1-parishes.csv', index, `no parish has the slug "${slug}".`)
        return
      }

      const data: Record<string, unknown> = {}
      const address: Record<string, unknown> = {}

      const name = cell(row.name)
      // A name is the one thing that may not be blanked: the record needs it.
      if (name === null) {
        problem('1-parishes.csv', index, 'name cannot be cleared — a parish must have a name.')
      } else if (name !== undefined && name !== parish.name) {
        data.name = name
      }

      setIfChanged(data, 'patron', cell(row.dedication), parish.patron)

      const deanery = resolveDeanery(row.deanery ?? '', '1-parishes.csv', index)
      if (deanery !== undefined && deanery !== (parish.deanery ?? null)) {
        data.deanery = deanery
      }

      const shrine = (row.is_shrine ?? '').trim()
      if (shrine !== '') {
        const parsed = parseYesNo(shrine)
        if (parsed === null) {
          problem('1-parishes.csv', index, `is_shrine must be yes or no, not "${shrine}".`)
        } else if (parsed !== Boolean(parish.isShrine)) {
          data.isShrine = parsed
        }
      }

      for (const [column, field] of [
        ['address_line1', 'line1'],
        ['address_line2', 'line2'],
        ['city', 'city'],
        ['district', 'district'],
        ['pincode', 'pincode'],
      ] as const) {
        setIfChanged(address, field, cell(row[column]), parish.address?.[field])
      }

      const pincode = cell(row.pincode)
      if (pincode && !/^\d{6}$/.test(pincode)) {
        problem(
          '1-parishes.csv',
          index,
          `pincode "${pincode}" is not six digits — left unchanged.`,
        )
        delete address.pincode
      }

      // Coordinates are only accepted as a pair; one without the other puts a
      // parish at the equator or the prime meridian.
      const latRaw = cell(row.latitude)
      const lonRaw = cell(row.longitude)

      if (latRaw === null || lonRaw === null) {
        if (parish.latitude != null || parish.longitude != null) {
          data.latitude = null
          data.longitude = null
        }
      } else if (latRaw !== undefined || lonRaw !== undefined) {
        if (latRaw === undefined || lonRaw === undefined) {
          problem(
            '1-parishes.csv',
            index,
            'latitude and longitude must be given together — neither was applied.',
          )
        } else {
          const lat = Number(latRaw)
          const lon = Number(lonRaw)

          if (Number.isNaN(lat) || Number.isNaN(lon)) {
            problem('1-parishes.csv', index, `coordinates "${latRaw}, ${lonRaw}" are not numbers.`)
          } else if (
            lat < BOUNDS.minLat ||
            lat > BOUNDS.maxLat ||
            lon < BOUNDS.minLon ||
            lon > BOUNDS.maxLon
          ) {
            problem(
              '1-parishes.csv',
              index,
              `coordinates ${lat}, ${lon} are outside Tamil Nadu. Latitude should be near 13 and longitude near 80 — are the two columns swapped?`,
            )
          } else if (lat !== parish.latitude || lon !== parish.longitude) {
            data.latitude = lat
            data.longitude = lon
          }
        }
      }

      setIfChanged(data, 'phone', cell(row.phone), parish.phone)

      const email = cell(row.email)
      if (email && !email.includes('@')) {
        problem('1-parishes.csv', index, `email "${email}" is not an email address.`)
      } else {
        setIfChanged(data, 'email', email, parish.email)
      }

      const year = cell(row.established_year)
      const currentYear = parish.established
        ? new Date(parish.established).getUTCFullYear().toString()
        : null

      if (year === null) {
        if (parish.established) data.established = null
      } else if (year !== undefined && year !== currentYear) {
        if (!/^\d{4}$/.test(year) || Number(year) > new Date().getFullYear()) {
          problem('1-parishes.csv', index, `established_year "${year}" is not a past four-digit year.`)
        } else {
          data.established = `${year}-01-01T00:00:00.000Z`
        }
      }

      if (Object.keys(data).length > 0) parishUpdates.set(parish.id, data)
      if (Object.keys(address).length > 0) addressUpdates.set(parish.id, address)
    })
  }

  // ---- 2. Mass timings --------------------------------------------------
  /**
   * Services are an array field, so they are written per parish as a whole.
   * A parish with no filled rows is left alone; a parish with at least one is
   * replaced by exactly what the sheet says. The instructions state this.
   */
  const servicesByParish = new Map<number | string, Record<string, unknown>[]>()

  if (timingSheet) {
    console.log(`2-mass-timings.csv: ${timingSheet.length} rows`)

    timingSheet.forEach((row, index) => {
      const slug = row.parish_slug?.trim()
      const day = (row.day ?? '').trim().toLowerCase()
      const time = (row.time ?? '').trim()

      // A row with no day and no time is an untouched template row.
      if (day === '' && time === '') return

      if (!slug) {
        problem('2-mass-timings.csv', index, 'parish_slug is empty.')
        return
      }

      const parish = parishBySlug.get(slug)
      if (!parish) {
        problem('2-mass-timings.csv', index, `no parish has the slug "${slug}".`)
        return
      }

      if (!DAYS.includes(day)) {
        problem(
          '2-mass-timings.csv',
          index,
          `day "${row.day}" is not one of sunday…saturday.`,
        )
        return
      }

      const parsed = parseTime(time)
      if ('error' in parsed) {
        problem('2-mass-timings.csv', index, parsed.error)
        return
      }

      const kind = ((row.kind ?? '').trim().toLowerCase() || 'mass')
      if (!KINDS.includes(kind)) {
        problem(
          '2-mass-timings.csv',
          index,
          `kind "${row.kind}" is not one of ${KINDS.join(', ')}.`,
        )
        return
      }

      const language = (row.language ?? '').trim().toLowerCase()
      if (language !== '' && !LANGUAGES.includes(language)) {
        problem(
          '2-mass-timings.csv',
          index,
          `language "${row.language}" is not one of ${LANGUAGES.join(', ')}.`,
        )
        return
      }

      const list = servicesByParish.get(parish.id) ?? []
      list.push({
        kind,
        day,
        time: parsed.iso,
        ...(language ? { language } : {}),
        ...(row.note?.trim() ? { note: row.note.trim() } : {}),
      })
      servicesByParish.set(parish.id, list)
    })
  }

  // ---- Apply parish changes --------------------------------------------
  let parishesChanged = 0
  let timingsWritten = 0

  const touchedParishes = new Set([
    ...parishUpdates.keys(),
    ...addressUpdates.keys(),
    ...servicesByParish.keys(),
  ])

  for (const id of touchedParishes) {
    const parish = parishes.docs.find((doc) => doc.id === id)
    if (!parish) continue

    const data: Record<string, unknown> = { ...(parishUpdates.get(id) ?? {}) }

    const address = addressUpdates.get(id)
    if (address) data.address = { ...(parish.address ?? {}), ...address }

    const services = servicesByParish.get(id)
    if (services) {
      data.services = services
      timingsWritten += services.length
    }

    /**
     * Clear the "needs review" flag only when the worksheet has actually
     * answered the note the importer left on the record: a dedication, an
     * address, and at least one **mass**.
     *
     * A novena or a confession time does not count. The note on these records
     * asks for mass timings specifically, and that is what a visitor comes for
     * — a parish listing a Tuesday novena and no Sunday mass is still
     * incomplete. Anything less and the flag stays, so the admin panel keeps
     * showing what is outstanding.
     */
    const dedication = data.patron ?? parish.patron
    const line1 =
      (data.address as { line1?: string } | undefined)?.line1 ?? parish.address?.line1
    const allServices = services ?? parish.services ?? []
    const hasMass = allServices.some((service) => service.kind === 'mass')

    if (dedication && line1 && hasMass) {
      data.legacy = { ...(parish.legacy ?? {}), needsReview: false, reviewNote: null }
      notes.push(`${parish.slug}: complete — review flag cleared`)
    }

    if (!DRY) {
      await payload.update({
        collection: 'parishes',
        id,
        locale: 'en',
        data: data as never,
      })
    }
    parishesChanged++
  }

  // ---- 3. Priest name decisions ----------------------------------------
  let namesResolved = 0
  let clergyCreated = 0

  if (nameSheet) {
    console.log(`3-priest-name-check.csv: ${nameSheet.length} rows`)

    for (const [index, row] of nameSheet.entries()) {
      const decision = (row.same_person ?? '').trim()
      if (decision === '') continue // not answered yet

      const same = parseYesNo(decision)
      if (same === null) {
        problem('3-priest-name-check.csv', index, `same_person must be yes or no, not "${decision}".`)
        continue
      }

      const existing = clergyBySlug.get(row.ref_directory_slug?.trim() ?? '')
      const letterName = row.ref_name_in_letter?.trim() ?? ''

      if (same) {
        // One priest. Keep the existing record; correct the spelling if given.
        const spelling = cell(row.correct_spelling)

        if (!existing) {
          problem(
            '3-priest-name-check.csv',
            index,
            `no clergy record has the slug "${row.ref_directory_slug}".`,
          )
          continue
        }

        if (spelling && spelling !== existing.name) {
          if (!DRY) {
            await payload.update({
              collection: 'clergy',
              id: existing.id,
              locale: 'en',
              data: {
                name: spelling,
                legacy: {
                  ...(existing.legacy ?? {}),
                  needsReview: false,
                  reviewNote: null,
                },
              } as never,
            })
          }
          notes.push(`clergy ${existing.slug}: renamed to "${spelling}" (confirmed by the curia)`)
        } else if (!DRY) {
          await payload.update({
            collection: 'clergy',
            id: existing.id,
            data: {
              legacy: { ...(existing.legacy ?? {}), needsReview: false, reviewNote: null },
            } as never,
          })
          notes.push(`clergy ${existing.slug}: confirmed as the same priest as "${letterName}"`)
        }
        namesResolved++
        continue
      }

      // Two different priests: the letter's name is missing from the directory.
      const display = stripHonorific(letterName)
      if (!display) {
        problem('3-priest-name-check.csv', index, 'ref_name_in_letter is empty.')
        continue
      }

      if (clergy.docs.some((doc) => nameKey(doc.name) === nameKey(display))) {
        notes.push(`clergy "${display}": already in the directory, nothing to create`)
        namesResolved++
        continue
      }

      let slug = slugify(display)
      let suffix = 2
      while (clergyBySlug.has(slug)) slug = `${slugify(display)}-${suffix++}`

      if (!DRY) {
        await payload.create({
          collection: 'clergy',
          data: {
            honorific: 'fr',
            name: display,
            slug,
            status: 'active',
            contactPublic: false,
            _status: 'published',
            legacy: {
              wpId: null,
              url: null,
              needsReview: true,
              reviewNote:
                'Created after the curia confirmed this is a different priest from the similarly-named record. Assignment still to be filled in.',
            },
          } as never,
        })
      }
      clergyCreated++
      namesResolved++
      notes.push(`clergy "${display}": created as a separate priest (confirmed by the curia)`)
    }
  }

  // ---- 4. Clergy deaneries ---------------------------------------------
  let clergyDeaneries = 0

  if (clergySheet) {
    console.log(`4-clergy-deanery.csv: ${clergySheet.length} rows`)

    for (const [index, row] of clergySheet.entries()) {
      const value = (row.deanery ?? '').trim()
      if (value === '') continue

      const slug = row.ref_slug?.trim()
      const priest = clergyBySlug.get(slug ?? '')
      if (!priest) {
        problem('4-clergy-deanery.csv', index, `no clergy record has the slug "${slug}".`)
        continue
      }

      const deanery = resolveDeanery(value, '4-clergy-deanery.csv', index)
      if (deanery === undefined) continue

      if (!DRY) {
        await payload.update({
          collection: 'clergy',
          id: priest.id,
          data: { deanery } as never,
        })
      }
      clergyDeaneries++
    }
  }

  // ---- Report -----------------------------------------------------------
  console.log(`\n${'-'.repeat(60)}`)
  console.log(`  parishes updated:            ${parishesChanged}`)
  console.log(`  service timings written:     ${timingsWritten}`)
  console.log(`  priest names resolved:       ${namesResolved} (${clergyCreated} new records)`)
  console.log(`  priests given a deanery:     ${clergyDeaneries}`)

  if (notes.length) {
    console.log(`\n  ${notes.length} notes:`)
    for (const note of notes.slice(0, 20)) console.log(`    ${note}`)
    if (notes.length > 20) console.log(`    ... and ${notes.length - 20} more`)
  }

  if (problems.length) {
    console.log(`\n  ${problems.length} PROBLEMS — these cells were skipped:`)
    for (const line of problems) console.log(`    ${line}`)
    console.log(
      `\n  Fix them in the worksheet and re-run. Everything else has been applied.`,
    )
  } else {
    console.log(`\n  No problems found.`)
  }

  if (DRY) {
    console.log(`\nDry run — nothing was written. Re-run "npm run worksheet:import" to apply.`)
  }

  process.exit(0)
}

await main()
