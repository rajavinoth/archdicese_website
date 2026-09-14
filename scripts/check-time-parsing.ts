/**
 * Checks the worksheet time parser against the site's own time formatter.
 *
 * These two have to agree or the site displays a different time from the one
 * the curia typed, which is the single worst failure this project could ship.
 * `parseTime` builds an instant; `formatTime` from src/lib/services.ts is what
 * every parish page actually renders. This asserts the round trip.
 *
 * Run with:  npm run check:times
 */

import { parseTime } from './lib/time'
import { bandOf, formatTime, minutesOfDay } from '../src/lib/services'

type Case = { input: string; expect: string; minutes: number; band: string }

/** Times that must parse, and what the parish page must then display. */
const ACCEPTED: Case[] = [
  { input: '6:00 am', expect: '6:00 am', minutes: 360, band: 'morning' },
  { input: '6 am', expect: '6:00 am', minutes: 360, band: 'morning' },
  { input: '6.30am', expect: '6:30 am', minutes: 390, band: 'morning' },
  { input: '7:30 AM', expect: '7:30 am', minutes: 450, band: 'morning' },
  { input: '11:45 am', expect: '11:45 am', minutes: 705, band: 'morning' },
  { input: '12:00 pm', expect: '12:00 pm', minutes: 720, band: 'afternoon' },
  { input: '12:15 pm', expect: '12:15 pm', minutes: 735, band: 'afternoon' },
  { input: '5 pm', expect: '5:00 pm', minutes: 1020, band: 'evening' },
  { input: '6:30 pm', expect: '6:30 pm', minutes: 1110, band: 'evening' },
  { input: '18:30', expect: '6:30 pm', minutes: 1110, band: 'evening' },
  { input: '23:59', expect: '11:59 pm', minutes: 1439, band: 'evening' },
  // Midnight and noon are the two that catch a naive 12-hour conversion.
  { input: '12:00 am', expect: '12:00 am', minutes: 0, band: 'morning' },
  { input: '00:30', expect: '12:30 am', minutes: 30, band: 'morning' },
]

/** Values that must be refused rather than guessed at. */
const REJECTED = [
  '6:00', // the important one: morning or evening?
  '7',
  '12:30',
  '25:00 am',
  '13:00 pm',
  '0 am',
  '6:75 pm',
  'half past six',
  '600',
  '',
]

let failures = 0

const fail = (message: string) => {
  failures++
  console.log(`  FAIL  ${message}`)
}

console.log('Accepted times must round-trip through the page formatter:\n')

for (const testCase of ACCEPTED) {
  const parsed = parseTime(testCase.input)

  if ('error' in parsed) {
    fail(`"${testCase.input}" was rejected: ${parsed.error}`)
    continue
  }

  // Intl uses a narrow no-break space before am/pm in some builds.
  const shown = formatTime(parsed.iso, 'en').replace(/\s/g, ' ').toLowerCase()
  const minutes = minutesOfDay(parsed.iso)
  const band = bandOf(parsed.iso)

  const problems = [
    shown !== testCase.expect ? `displays "${shown}", expected "${testCase.expect}"` : null,
    minutes !== testCase.minutes ? `sorts at ${minutes}, expected ${testCase.minutes}` : null,
    band !== testCase.band ? `banded "${band}", expected "${testCase.band}"` : null,
  ].filter(Boolean)

  if (problems.length) {
    fail(`"${testCase.input}" -> ${problems.join('; ')}`)
  } else {
    console.log(`  ok    "${testCase.input}" -> ${shown}  (${minutes} min, ${band})`)
  }
}

console.log('\nAmbiguous or invalid times must be refused:\n')

for (const input of REJECTED) {
  const parsed = parseTime(input)
  if ('error' in parsed) {
    console.log(`  ok    "${input}" refused — ${parsed.error}`)
  } else {
    fail(`"${input}" was ACCEPTED as ${formatTime(parsed.iso, 'en')} — it should be refused`)
  }
}

console.log(
  `\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`,
)

process.exit(failures === 0 ? 0 : 1)
