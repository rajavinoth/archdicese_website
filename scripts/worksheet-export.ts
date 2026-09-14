/**
 * Writes the worksheets the archdiocese fills in, into ./worksheet/.
 *
 * Why a spreadsheet and not the admin panel
 * -----------------------------------------
 * Everything still missing from this site is information only the curia has:
 * parish dedications, addresses, coordinates, the deanery each parish belongs
 * to, and above all **mass timings**. None of it can be derived, guessed or
 * scraped — the previous website never published it.
 *
 * Asking one person to open 56 parish records in a CMS they have never seen is
 * how that request dies. A spreadsheet with the parish name already in it, and
 * the priest's name beside it so the row is recognisable, is something a
 * secretary can fill in over a week and email back.
 *
 * Safety rules, because this file crosses a desk and comes back
 * -------------------------------------------------------------
 *  1. **Never overwrite a worksheet that already exists.** A re-run after the
 *     curia has started typing would destroy their work. Pass
 *     WORKSHEET_FORCE=1 to replace files deliberately.
 *  2. Columns named `ref_*` are reference only — they identify the row and are
 *     ignored on import. Everything else is fillable.
 *  3. Fillable columns are **pre-filled with what the site already holds**, so
 *     the person can see what is there and correct it rather than retyping it.
 *
 * Run with:  npm run worksheet:export
 *            WORKSHEET_FORCE=1 npm run worksheet:export
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

import { toCsv, type Row } from './lib/csv'
import { findNearMatch, nameKey, stripHonorific } from './lib/names'
import { formatTimeForWorksheet } from './lib/time'

const FORCE = process.env.WORKSHEET_FORCE === '1'
const OUT = path.resolve('worksheet')

type Letter = {
  source: Record<string, string>
  parishPriests: { place: string; priest: string; congregation?: boolean }[]
  assistantParishPriests: { place: string; priest: string; congregation?: boolean }[]
  specialMinistries: { priest: string; role?: string }[]
  higherStudies: { priest: string }[]
  onLeave: string[]
  retirement: string[]
}

/** Refuses to clobber a worksheet somebody may already be filling in. */
const write = async (name: string, contents: string): Promise<boolean> => {
  const file = path.join(OUT, name)

  try {
    await fs.access(file)
    if (!FORCE) {
      console.log(`  SKIPPED ${name} — it already exists (WORKSHEET_FORCE=1 to replace)`)
      return false
    }
  } catch {
    // Does not exist yet, which is the normal case.
  }

  await fs.writeFile(file, contents, 'utf8')
  console.log(`  wrote ${name}`)
  return true
}

const yesNo = (value: unknown): string => (value ? 'yes' : 'no')

const nameOf = (value: unknown): string =>
  typeof value === 'object' && value !== null && 'name' in value
    ? String((value as { name: unknown }).name)
    : ''

const main = async () => {
  const payload = await getPayload({ config })
  await fs.mkdir(OUT, { recursive: true })

  const deaneries = await payload.find({
    collection: 'deaneries',
    limit: 100,
    sort: 'name',
    depth: 0,
  })

  // ---- 1. Parishes ------------------------------------------------------
  const parishes = await payload.find({
    collection: 'parishes',
    limit: 1000,
    sort: 'name',
    depth: 1, // resolve deanery and parishPriest for the reference columns
    pagination: false,
  })

  const parishColumns = [
    'ref_slug',
    'ref_current_name',
    'ref_parish_priest',
    'name',
    'dedication',
    'deanery',
    'is_shrine',
    'address_line1',
    'address_line2',
    'city',
    'district',
    'pincode',
    'latitude',
    'longitude',
    'phone',
    'email',
    'established_year',
  ]

  const parishRows: Row[] = parishes.docs.map((parish) => ({
    ref_slug: parish.slug,
    ref_current_name: parish.name,
    ref_parish_priest: nameOf(parish.parishPriest),
    name: parish.name,
    dedication: parish.patron ?? '',
    deanery: nameOf(parish.deanery),
    is_shrine: yesNo(parish.isShrine),
    address_line1: parish.address?.line1 ?? '',
    address_line2: parish.address?.line2 ?? '',
    city: parish.address?.city ?? '',
    district: parish.address?.district ?? '',
    pincode: parish.address?.pincode ?? '',
    latitude: parish.latitude != null ? String(parish.latitude) : '',
    longitude: parish.longitude != null ? String(parish.longitude) : '',
    phone: parish.phone ?? '',
    email: parish.email ?? '',
    established_year: parish.established
      ? new Date(parish.established).getUTCFullYear().toString()
      : '',
  }))

  await write('1-parishes.csv', toCsv(parishColumns, parishRows))

  // ---- 2. Mass timings --------------------------------------------------
  /**
   * One blank row per parish, pre-labelled with its slug and name. The person
   * filling it in copies a row down as many times as that parish needs
   * services, so they never have to type or guess a slug. Existing timings are
   * exported too, so a re-run does not lose them.
   */
  const timingColumns = [
    'ref_parish_name',
    'parish_slug',
    'kind',
    'day',
    'time',
    'language',
    'note',
  ]

  const timingRows: Row[] = []

  let sampleParishes = 0

  for (const parish of parishes.docs) {
    /**
     * Sample timings must never reach this file. They are invented (see
     * scripts/timings-sample.ts), so exporting them would hand the curia a
     * worksheet pre-filled with 391 made-up times, which they would
     * reasonably assume came from their own records — and might then confirm.
     * A sample-flagged parish is exported as though it had no timings at all.
     */
    const services = parish.timingsAreSample ? [] : (parish.services ?? [])
    if (parish.timingsAreSample) sampleParishes++

    if (services.length === 0) {
      timingRows.push({
        ref_parish_name: parish.name,
        parish_slug: parish.slug,
        kind: 'mass',
        day: '',
        time: '',
        language: '',
        note: '',
      })
      continue
    }

    for (const service of services) {
      timingRows.push({
        ref_parish_name: parish.name,
        parish_slug: parish.slug,
        kind: service.kind ?? 'mass',
        day: service.day ?? '',
        // Written back in the same "6:00 am" shape the importer accepts --
        // the two share one module so a round trip cannot drift.
        time: service.time ? formatTimeForWorksheet(service.time) : '',
        language: service.language ?? '',
        note: service.note ?? '',
      })
    }
  }

  await write('2-mass-timings.csv', toCsv(timingColumns, timingRows))

  if (sampleParishes > 0) {
    console.log(
      `  (${sampleParishes} parishes are currently showing sample timings; those were\n   left out of the worksheet so they cannot be mistaken for real ones)`,
    )
  }

  // ---- 3. Priest names that could not be matched ------------------------
  /**
   * The four names the appointments importer refused to act on, because each
   * looks like an existing record spelled differently. Creating them blindly
   * would have put duplicate priests in the directory; only the curia can say
   * which spelling is right.
   */
  const raw = await fs.readFile(
    path.resolve('scripts/data/appointments-2026.json'),
    'utf8',
  )
  const letter = JSON.parse(raw) as Letter

  const clergy = await payload.find({
    collection: 'clergy',
    limit: 1000,
    depth: 0,
    pagination: false,
  })
  const byName = new Map(clergy.docs.map((doc) => [nameKey(doc.name), doc]))

  const letterNames = new Set<string>()
  const addName = (value: string, congregation?: boolean) => {
    if (!congregation && value.trim()) letterNames.add(stripHonorific(value))
  }
  for (const entry of letter.parishPriests) addName(entry.priest, entry.congregation)
  for (const entry of letter.assistantParishPriests) addName(entry.priest, entry.congregation)
  for (const entry of letter.specialMinistries) addName(entry.priest)
  for (const entry of letter.higherStudies) addName(entry.priest)
  for (const name of letter.onLeave) addName(name)
  for (const name of letter.retirement) addName(name)

  const variantRows: Row[] = []

  for (const displayName of letterNames) {
    const key = nameKey(displayName)
    if (byName.has(key)) continue // matched exactly; nothing to ask

    const near = findNearMatch(key, byName)
    if (!near) continue // genuinely new; already created by appointments:apply

    variantRows.push({
      ref_name_in_letter: displayName,
      ref_name_in_directory: near.name,
      ref_directory_slug: near.slug,
      same_person: '',
      correct_spelling: '',
    })
  }

  await write(
    '3-priest-name-check.csv',
    toCsv(
      [
        'ref_name_in_letter',
        'ref_name_in_directory',
        'ref_directory_slug',
        'same_person',
        'correct_spelling',
      ],
      variantRows,
    ),
  )

  // ---- 4. Which deanery each priest belongs to --------------------------
  const clergyRows: Row[] = clergy.docs
    .filter((doc) => doc.status !== 'deceased')
    .map((doc) => ({
      ref_slug: doc.slug,
      ref_name: doc.name,
      ref_current_assignment: doc.currentAssignment ?? '',
      deanery: '',
    }))
    .sort((a, b) => a.ref_name.localeCompare(b.ref_name))

  await write(
    '4-clergy-deanery.csv',
    toCsv(['ref_slug', 'ref_name', 'ref_current_assignment', 'deanery'], clergyRows),
  )

  // ---- Instructions -----------------------------------------------------
  const deaneryList = deaneries.docs
    .map((deanery) => `  - ${deanery.name}${deanery.seat ? ` (seat: ${deanery.seat})` : ''}`)
    .join('\n')

  const instructions = `# Filling in the archdiocesan website worksheets

Thank you for doing this. These four files hold the only information the new
website is still missing. Everything else has been taken from the previous
website and from the 2026 appointments letter (${letter.source.reference}).

Please open them in Excel, Google Sheets or LibreOffice, fill in what you know,
and send them back. **Partial is fine** — whatever comes back gets published,
and the rest can follow later.

## The two rules

1. **Columns whose name starts with \`ref_\` are for reference only.** They tell
   you which row you are on. Changing them does nothing; deleting them breaks
   the file.

2. **A blank cell means "leave it as it is" — not "delete it".** Cells already
   containing something are showing you what the website holds today. Correct
   them if they are wrong. If something on the site is wrong and there is no
   replacement, put a single dash \`-\` in the cell to clear it.

Please do not add, remove or rename columns, and do not re-order them.

---

## 1-parishes.csv — one row per parish

There are ${parishRows.length} parishes. Each one currently shows the **place**
name from the appointments letter, because that is all the letter gives.

| Column | What to put |
| --- | --- |
| \`name\` | The parish's proper name, e.g. "St Antony's Church, Adyar" |
| \`dedication\` | Who the church is dedicated to, e.g. "St Antony" |
| \`deanery\` | One of the six names listed below |
| \`is_shrine\` | \`yes\` for a shrine or basilica, otherwise \`no\` |
| \`address_line1\`, \`address_line2\`, \`city\`, \`district\`, \`pincode\` | The postal address |
| \`latitude\`, \`longitude\` | See "Finding coordinates" below. **Many are already filled in from OpenStreetMap and are only approximate — the centre of the locality, not the church.** Please correct them |
| \`phone\`, \`email\` | The parish office, if it has its own |
| \`established_year\` | Four digits, e.g. \`1904\`. Leave blank if unsure |

The six deaneries, exactly as the website knows them:

${deaneryList}

### Finding coordinates

Only needed for the map. Open <https://www.openstreetmap.org>, search for the
church, right-click the spot and choose "Show address" — the two numbers appear
in the search box, latitude first. Chennai latitudes are near \`13.0\` and
longitudes near \`80.2\`. If in doubt leave both blank; a wrong pin is worse
than no pin.

---

## 2-mass-timings.csv — the most important file

**This is the thing people come to the website for.** The site currently says
"Timings have not been published for this parish yet" on every parish, because
publishing a guessed mass time could send somebody to a church at the wrong
hour. Nothing here has been invented.

There is one blank row per parish. **Copy the row down** as many times as that
parish needs — one row per service — keeping \`parish_slug\` the same.

| Column | What to put |
| --- | --- |
| \`kind\` | \`mass\`, \`novena\`, \`adoration\` or \`confession\` |
| \`day\` | \`sunday\` … \`saturday\` |
| \`time\` | **Always include am or pm**: \`6:00 am\`, \`6:30 pm\`. See the note below |
| \`language\` | \`tamil\`, \`english\`, \`telugu\`, \`hindi\`, \`malayalam\` or \`latin\` |
| \`note\` | Anything conditional: \`Vigil\`, \`First Friday only\`, \`Not during Lent\` |

**About the time column.** A bare \`6:00\` will be **rejected**, not guessed,
because it could mean the morning or the evening mass and getting it wrong is
the worst mistake this website could make. Write \`6:00 am\` or \`6:00 pm\`.
(\`18:30\` is accepted, since it can only mean one thing.)

A parish with no rows filled in is left exactly as it is. A parish with at
least one filled row has its timings **replaced** by what is in this file, so
please list all of that parish's services, not just the new ones.

---

## 3-priest-name-check.csv — ${variantRows.length} name${variantRows.length === 1 ? '' : 's'} to confirm

The appointments letter and the old website spell these priests' names
differently. Rather than risk creating the same priest twice in the directory,
we stopped and are asking.

| Column | What to put |
| --- | --- |
| \`same_person\` | \`yes\` if the two names are one priest, \`no\` if they are two different priests |
| \`correct_spelling\` | If \`yes\`: how the name should be spelled. Leave blank to keep the directory's version |

---

## 4-clergy-deanery.csv — which deanery each priest serves in

${clergyRows.length} priests, sorted by name. Fill in the \`deanery\` column
using the same six names as above. Nothing published anywhere maps priests to
deaneries, so this column is empty everywhere on the site today.

Leave a row blank if the priest is not attached to a deanery — the curia,
seminary staff, priests on studies and retired priests.

---

## Sending it back

Save each file in the same format (\`.csv\`) and send all four. If Excel offers
"CSV UTF-8", choose it — that keeps Tamil names readable.

Generated ${new Date().toISOString().slice(0, 10)}.
`

  await write('HOW-TO-FILL-THIS-IN.md', instructions)

  console.log(`\nWorksheets are in ./worksheet/`)
  console.log(`  ${parishRows.length} parishes`)
  console.log(`  ${timingRows.length} mass-timing rows (one blank row per parish with none)`)
  console.log(`  ${variantRows.length} priest names to confirm`)
  console.log(`  ${clergyRows.length} priests needing a deanery`)
  console.log(`\nSend the four CSVs plus HOW-TO-FILL-THIS-IN.md to the curia.`)
  console.log(`Read them back with: npm run worksheet:import`)

  process.exit(0)
}

await main()
