/**
 * Loads sample mass timings so the parish finder can be seen working.
 *
 * Read this before running it
 * ---------------------------
 * These timings are **invented**. The archdiocese has not published its mass
 * schedule, and a wrong mass time is the most harmful thing this site could
 * print — somebody arrives at a locked church. Earlier in this project the
 * seed's invented timings were deliberately deleted for exactly that reason.
 *
 * They exist here because a finder with nothing to find cannot be reviewed or
 * demonstrated. What makes that acceptable is that the data announces itself:
 *
 *  - every parish written by this script gets `timingsAreSample: true`
 *  - the parish page prints a warning above the table, in both languages
 *  - the finder prints a warning above the results
 *  - `npm run timings:sample clear` removes every sample set in one command
 *  - a parish whose timings are NOT flagged as samples is never touched, so
 *    real timings entered later cannot be overwritten or wiped
 *
 * Before launch, run the clear command. The worksheet
 * (npm run worksheet:export) is how the real timings arrive.
 *
 * Why the schedules vary
 * ---------------------
 * Identical timings at 56 parishes would make the finder look like it works
 * while testing nothing: every language filter, every day filter and every
 * time-of-day band would return the same set. The variant is chosen from a
 * hash of the parish slug, so it is stable across runs but different between
 * parishes, and the filters have something to discriminate.
 *
 * Run with:  npm run timings:sample
 *            npm run timings:sample clear
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import { parseTime } from './lib/time'

const CLEAR = process.argv.includes('clear') || process.env.TIMINGS_CLEAR === '1'

type Service = {
  kind: 'mass' | 'novena' | 'adoration' | 'confession'
  day: string
  time: string
  language?: string
  note?: string
}

/**
 * Weekday and Sunday patterns modelled on how Chennai parishes actually
 * publish their schedules: an early Tamil mass, a mid-morning English one at
 * the bigger parishes, an evening Tamil mass, a Saturday vigil, a weekday
 * morning mass, and a weekly novena.
 */
const VARIANTS: Service[][] = [
  // 0 — a large city parish, Tamil and English
  [
    { kind: 'mass', day: 'sunday', time: '5:30 am', language: 'tamil' },
    { kind: 'mass', day: 'sunday', time: '7:00 am', language: 'tamil' },
    { kind: 'mass', day: 'sunday', time: '9:00 am', language: 'english' },
    { kind: 'mass', day: 'sunday', time: '6:00 pm', language: 'tamil' },
    { kind: 'mass', day: 'saturday', time: '6:00 pm', language: 'tamil', note: 'Vigil' },
    { kind: 'mass', day: 'monday', time: '6:00 am', language: 'tamil' },
    { kind: 'mass', day: 'wednesday', time: '6:00 am', language: 'tamil' },
    { kind: 'mass', day: 'friday', time: '6:15 pm', language: 'tamil' },
    { kind: 'novena', day: 'tuesday', time: '6:15 pm', language: 'tamil' },
    { kind: 'confession', day: 'saturday', time: '5:00 pm' },
  ],
  // 1 — a smaller parish, Tamil only
  [
    { kind: 'mass', day: 'sunday', time: '6:30 am', language: 'tamil' },
    { kind: 'mass', day: 'sunday', time: '8:30 am', language: 'tamil' },
    { kind: 'mass', day: 'tuesday', time: '6:00 am', language: 'tamil' },
    { kind: 'mass', day: 'thursday', time: '6:00 am', language: 'tamil' },
    { kind: 'novena', day: 'saturday', time: '5:30 pm', language: 'tamil' },
    { kind: 'confession', day: 'saturday', time: '5:00 pm' },
  ],
  // 2 — an English-leaning parish with a Malayalam community mass
  [
    { kind: 'mass', day: 'sunday', time: '6:00 am', language: 'tamil' },
    { kind: 'mass', day: 'sunday', time: '8:00 am', language: 'english' },
    { kind: 'mass', day: 'sunday', time: '10:00 am', language: 'malayalam' },
    { kind: 'mass', day: 'sunday', time: '6:30 pm', language: 'english' },
    { kind: 'mass', day: 'saturday', time: '6:30 pm', language: 'english', note: 'Vigil' },
    { kind: 'mass', day: 'monday', time: '6:30 am', language: 'english' },
    { kind: 'adoration', day: 'friday', time: '6:30 pm', note: 'First Friday only' },
    { kind: 'confession', day: 'saturday', time: '5:30 pm' },
  ],
  // 3 — a town parish with a Telugu mass
  [
    { kind: 'mass', day: 'sunday', time: '6:00 am', language: 'tamil' },
    { kind: 'mass', day: 'sunday', time: '9:30 am', language: 'telugu' },
    { kind: 'mass', day: 'sunday', time: '5:30 pm', language: 'tamil' },
    { kind: 'mass', day: 'wednesday', time: '6:15 pm', language: 'tamil' },
    { kind: 'novena', day: 'wednesday', time: '6:45 pm', language: 'tamil' },
    { kind: 'confession', day: 'sunday', time: '5:00 pm' },
  ],
  // 4 — a village parish: Sunday only, plus one weekday
  [
    { kind: 'mass', day: 'sunday', time: '7:00 am', language: 'tamil' },
    { kind: 'mass', day: 'friday', time: '6:00 pm', language: 'tamil' },
    { kind: 'novena', day: 'friday', time: '6:30 pm', language: 'tamil' },
  ],
]

/** A shrine or cathedral: more masses, more languages, daily confession. */
const SHRINE: Service[] = [
  { kind: 'mass', day: 'sunday', time: '5:00 am', language: 'tamil' },
  { kind: 'mass', day: 'sunday', time: '6:30 am', language: 'tamil' },
  { kind: 'mass', day: 'sunday', time: '8:00 am', language: 'english' },
  { kind: 'mass', day: 'sunday', time: '10:00 am', language: 'english' },
  { kind: 'mass', day: 'sunday', time: '12:00 pm', language: 'tamil' },
  { kind: 'mass', day: 'sunday', time: '6:00 pm', language: 'english' },
  { kind: 'mass', day: 'monday', time: '6:00 am', language: 'tamil' },
  { kind: 'mass', day: 'tuesday', time: '6:00 am', language: 'tamil' },
  { kind: 'mass', day: 'wednesday', time: '6:00 am', language: 'tamil' },
  { kind: 'mass', day: 'thursday', time: '6:00 am', language: 'tamil' },
  { kind: 'mass', day: 'friday', time: '6:00 am', language: 'tamil' },
  { kind: 'mass', day: 'saturday', time: '6:00 pm', language: 'tamil', note: 'Vigil' },
  { kind: 'novena', day: 'saturday', time: '5:00 pm', language: 'tamil' },
  { kind: 'adoration', day: 'thursday', time: '6:30 pm' },
  { kind: 'confession', day: 'saturday', time: '4:30 pm' },
]

/** Stable per-slug hash, so a parish keeps the same sample schedule. */
const hashOf = (input: string): number => {
  let hash = 0
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

const NOTE =
  'SAMPLE TIMINGS — invented for demonstration, not published by the parish. Remove with "npm run timings:sample clear" before launch.'

const main = async () => {
  const payload = await getPayload({ config })

  const parishes = await payload.find({
    collection: 'parishes',
    limit: 1000,
    depth: 0,
    pagination: false,
  })

  if (CLEAR) {
    let cleared = 0
    let leftAlone = 0

    for (const parish of parishes.docs) {
      if (!parish.timingsAreSample) {
        // Either it has no timings, or it has real ones. Either way, not ours.
        if ((parish.services?.length ?? 0) > 0) leftAlone++
        continue
      }

      await payload.update({
        collection: 'parishes',
        id: parish.id,
        data: {
          services: [],
          timingsAreSample: false,
          legacy: {
            ...(parish.legacy ?? {}),
            reviewNote: (parish.legacy?.reviewNote ?? '')
              .replace(NOTE, '')
              .replace(/\s{2,}/g, ' ')
              .trim(),
          },
        } as never,
        context: { disableRevalidate: true },
      })
      cleared++
    }

    console.log(`Cleared sample timings from ${cleared} parishes.`)
    if (leftAlone) {
      console.log(
        `Left ${leftAlone} parishes alone — their timings are not flagged as samples, so they are real.`,
      )
    }
    process.exit(0)
  }

  let written = 0
  let protectedCount = 0
  let services = 0

  for (const parish of parishes.docs) {
    /**
     * Never overwrite timings that are not flagged as samples. If somebody has
     * entered a real schedule, this script must not touch it.
     */
    if ((parish.services?.length ?? 0) > 0 && !parish.timingsAreSample) {
      protectedCount++
      continue
    }

    const pattern = parish.isShrine
      ? SHRINE
      : VARIANTS[hashOf(parish.slug) % VARIANTS.length]

    const rows = pattern.map((service) => {
      const parsed = parseTime(service.time)
      if ('error' in parsed) throw new Error(`${parish.slug}: ${parsed.error}`)
      return {
        kind: service.kind,
        day: service.day,
        time: parsed.iso,
        ...(service.language ? { language: service.language } : {}),
        ...(service.note ? { note: service.note } : {}),
      }
    })

    await payload.update({
      collection: 'parishes',
      id: parish.id,
      locale: 'en',
      data: {
        services: rows,
        timingsAreSample: true,
        legacy: {
          ...(parish.legacy ?? {}),
          needsReview: true,
          reviewNote: [parish.legacy?.reviewNote, NOTE].filter(Boolean).join(' '),
        },
      } as never,
      context: { disableRevalidate: true },
    })

    written++
    services += rows.length
  }

  console.log(`Sample timings written to ${written} parishes (${services} services).`)
  if (protectedCount) {
    console.log(
      `${protectedCount} parishes were skipped because they already have real timings.`,
    )
  }
  console.log(
    `\nEvery one is flagged as a sample and labelled as such on the site.\nRemove them with:  npm run timings:sample clear`,
  )

  process.exit(0)
}

await main()
