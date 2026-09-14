/**
 * Fills in parish coordinates from OpenStreetMap.
 *
 * Why this may write coordinates when earlier scripts would not
 * -------------------------------------------------------------
 * Coordinates were left empty until now because the only alternative was to
 * invent them. This does not invent them: it looks each parish up in
 * OpenStreetMap, a citable public source, and records **which OSM object it
 * matched, and how precisely** on the record. Anyone can check the answer.
 *
 * Two tiers of precision, and the difference is published
 * -------------------------------------------------------
 * Asking OpenStreetMap for every Catholic church in the archdiocese returns
 * about thirty, several of them mis-tagged, and seven belonging to the
 * Syro-Malabar eparchy rather than to Madras-Mylapore. There is simply not
 * enough data to put 56 parishes on their own doorsteps. So:
 *
 *   `church`   — an actual place of worship was matched by name.
 *   `locality` — only the centre of the locality could be found. Accurate to a
 *                few hundred metres, which is fine for "find mass near me" and
 *                for a map pin, but it is not the church door. The parish page
 *                says so.
 *
 * What stops it writing nonsense
 * ------------------------------
 *  1. **Only `place_of_worship` results count as a church match.** Searching
 *     "Little Mount, Chennai" returns a railway station; "Adyar" returns a
 *     river; "Porur" returns a lake. Without this filter parishes would be
 *     pinned to water.
 *  2. **Syro-Malabar and Syro-Malankara churches are rejected.** They are
 *     Catholic but belong to a different eparchy, so pinning a Madras-Mylapore
 *     parish to one would be wrong. Three of them matched on the first run.
 *  3. **Non-Christian and Protestant results are rejected**, by OSM's religion
 *     and denomination tags or, failing those, by the name.
 *  4. **Everything must fall inside the archdiocese's bounding box.**
 *  5. **Nothing already on the record is overwritten.** Whatever the curia has
 *     supplied outranks a crowd-sourced guess.
 *
 * Aliases are only used where the church is a checkable landmark under a
 * different name than its place. Guessing a dedication to search for — "Sacred
 * Heart Church, Egmore" — risks matching a real but wrong church, so the list
 * below holds only names that can be verified, not surmised.
 *
 * Results cache to .migration/geocode-cache.json, so re-running costs no
 * further requests. Nominatim's usage policy asks for a real User-Agent and at
 * most one request a second; both are honoured.
 *
 * Run with:  npm run parishes:geocode
 *            GEOCODE_DRY=1 npm run parishes:geocode
 *            GEOCODE_REFRESH=1 npm run parishes:geocode   (ignore the cache)
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.GEOCODE_DRY === '1'
const REFRESH = process.env.GEOCODE_REFRESH === '1'

const CACHE_FILE = path.resolve('.migration/geocode-cache.json')

const USER_AGENT =
  'ADMM-website-migration/1.0 (Archdiocese of Madras-Mylapore site rebuild; one-off parish geocoding)'

/** Nominatim asks for at most one request per second. */
const PACE_MS = 1200

/**
 * The archdiocese covers the city of Chennai and Tiruvallur district, reaching
 * north to Gummidipoondi and west past Uthukottai.
 */
const BBOX = { minLat: 12.75, maxLat: 13.65, minLon: 79.75, maxLon: 80.45 }

/** OSM place types that count as "the centre of the locality". */
const LOCALITY_TYPES = new Set([
  'suburb',
  'neighbourhood',
  'quarter',
  'town',
  'village',
  'locality',
  'city_district',
  'hamlet',
  'residential',
])

const CHRISTIAN_WORDS =
  /church|cathedral|basilica|shrine|chapel|parish|catholic|ஆலயம்/i

/** Protestant and other non-Catholic markers that appear in OSM names. */
const NOT_CATHOLIC =
  /\bc\.?s\.?i\b|church of south india|pentecost|baptist|lutheran|methodist|wesley|assembly of god|adventist|orthodox|anglican/i

/**
 * Eastern Catholic churches: Catholic, but not part of the Archdiocese of
 * Madras-Mylapore, which is Latin rite. Matching one would be a real error —
 * three did on the first run.
 */
const OTHER_RITE = /malabar|malankara|syro|syrian/i

type NominatimResult = {
  lat: string
  lon: string
  type: string
  display_name: string
  osm_id?: number
  osm_type?: string
  name?: string
  address?: Record<string, string>
  extratags?: Record<string, string> | null
}

/**
 * Chennai's well-known suburbs are often in OSM only as Corporation zone
 * boundaries — "Adyar", "Royapuram" and "Tondiarpet" each return
 * `type: administrative` named "Zone 13 Adyar" and nothing else. Excluding
 * those left 27 parishes unlocated for no good reason: a zone centroid is a
 * fair "centre of the locality".
 *
 * The guard is that the place name must appear in the matched boundary's own
 * name, so "Adyar" can match "Zone 13 Adyar" but not the whole of Chennai or a
 * district several towns wide.
 */
const administrativeMatches = (result: NominatimResult, place: string): boolean => {
  if (result.type !== 'administrative') return false
  const first = result.display_name.split(',')[0].toLowerCase()
  return first.includes(place.toLowerCase())
}

type Match = {
  precision: 'church' | 'locality'
  query: string
  result: NominatimResult
}

type CacheEntry = { match: Match | null; reason?: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const inBox = (result: NominatimResult): boolean => {
  const lat = Number(result.lat)
  const lon = Number(result.lon)
  return (
    lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon
  )
}

const search = async (
  query: string,
  extra?: Record<string, string>,
): Promise<NominatimResult[]> => {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  for (const [key, value] of Object.entries(extra ?? {})) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '8')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('extratags', '1')
  url.searchParams.set('countrycodes', 'in')
  // Bias towards the archdiocese without excluding results outright --
  // `bounded=1` turned two thirds of these searches into "no results".
  url.searchParams.set(
    'viewbox',
    `${BBOX.minLon},${BBOX.minLat},${BBOX.maxLon},${BBOX.maxLat}`,
  )

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Nominatim ${response.status} for "${query}"`)
  return (await response.json()) as NominatimResult[]
}

/** Is this result a Latin-rite Catholic church we may use? */
const churchProblem = (result: NominatimResult): string | null => {
  if (result.type !== 'place_of_worship') return `is a ${result.type}`
  if (!inBox(result)) return 'outside the archdiocese'

  const name = result.display_name
  if (OTHER_RITE.test(name)) return 'Syro-Malabar / Syro-Malankara (different eparchy)'
  if (NOT_CATHOLIC.test(name)) return 'not a Catholic church'

  const religion = result.extratags?.religion?.toLowerCase()
  const denomination = result.extratags?.denomination?.toLowerCase()

  if (religion && religion !== 'christian') return `religion=${religion}`
  if (denomination && OTHER_RITE.test(denomination)) return `denomination=${denomination}`
  if (denomination && NOT_CATHOLIC.test(denomination)) return `denomination=${denomination}`
  if (!religion && !CHRISTIAN_WORDS.test(name)) return 'name does not look like a church'

  return null
}

/**
 * Churches that are checkable landmarks under a name other than their place.
 * Deliberately short: each is a well-known Chennai church whose identity can be
 * confirmed, not a guess at a dedication.
 */
const ALIASES: Record<string, string> = {
  'san-thome-cathedral-basilica': 'Santhome Basilica, Chennai',
  'besant-nagar': 'Annai Velankanni Shrine, Besant Nagar, Chennai',
  luz: 'Luz Church, Chennai',
}

const churchQueries = (name: string, alias?: string): string[] => {
  if (alias) return [alias]
  const place = name.replace(/\s+/g, ' ').trim()
  // If the parish is already named after its church, search that directly.
  if (CHRISTIAN_WORDS.test(place)) return [`${place}, Chennai, Tamil Nadu`]
  return [
    `${place} Catholic Church, Chennai, Tamil Nadu`,
    `${place} Church, Chennai, Tamil Nadu`,
  ]
}

/** The bare place name, with any church wording stripped off. */
const localityName = (name: string): string =>
  name
    .replace(/\b(church|cathedral|basilica|shrine|chapel)\b/gi, '')
    .replace(/^(st|our lady of|the)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

const localityQueries = (name: string): string[] => {
  const place = localityName(name)
  if (!place) return []
  return [`${place}, Chennai, Tamil Nadu, India`, `${place}, Tiruvallur, Tamil Nadu, India`]
}

const main = async () => {
  const payload = await getPayload({ config })

  const cache: Record<string, CacheEntry> = REFRESH
    ? {}
    : await fs
        .readFile(CACHE_FILE, 'utf8')
        .then((text) => JSON.parse(text) as Record<string, CacheEntry>)
        .catch(() => ({}))

  const parishes = await payload.find({
    collection: 'parishes',
    limit: 1000,
    sort: 'name',
    depth: 0,
    pagination: false,
  })

  const saveCache = async () => {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  }

  let atChurch = 0
  let atLocality = 0
  let missed = 0
  let skipped = 0
  const churchHits: string[] = []
  const localityHits: string[] = []
  const misses: string[] = []

  for (const parish of parishes.docs) {
    if (parish.latitude != null && parish.longitude != null) {
      skipped++
      continue
    }

    let entry = cache[parish.slug]

    if (!entry) {
      let match: Match | null = null
      let reason = 'no results'

      // Pass 1: the church itself.
      for (const query of churchQueries(parish.name, ALIASES[parish.slug])) {
        let results: NominatimResult[] = []
        try {
          results = await search(query)
        } catch (error) {
          console.log(`  ! ${parish.slug}: ${(error as Error).message}`)
        }
        await sleep(PACE_MS)

        for (const result of results) {
          const problem = churchProblem(result)
          if (!problem) {
            match = { precision: 'church', query, result }
            break
          }
          reason = problem
        }
        if (match) break
      }

      /**
       * Pass 2: the settlement itself.
       *
       * Runs before the general locality search because a plain query for
       * "Avadi, Chennai" ranks four stretches of Avadi Road above the town of
       * Avadi, and "Minjur" returns its ESI hospital. `featureType=settlement`
       * restricts the answer to cities, towns, villages and suburbs, which is
       * exactly the question being asked.
       */
      if (!match) {
        const place = localityName(parish.name)
        if (place) {
          let results: NominatimResult[] = []
          try {
            results = await search(`${place}, Tamil Nadu, India`, {
              featureType: 'settlement',
            })
          } catch (error) {
            console.log(`  ! ${parish.slug}: ${(error as Error).message}`)
          }
          await sleep(PACE_MS)

          const hit = results.find((result) => inBox(result))
          if (hit) {
            match = {
              precision: 'locality',
              query: `${place} (settlement)`,
              result: hit,
            }
          }
        }
      }

      // Pass 3: any locality-shaped result, or a Corporation zone.
      if (!match) {
        for (const query of localityQueries(parish.name)) {
          let results: NominatimResult[] = []
          try {
            results = await search(query)
          } catch (error) {
            console.log(`  ! ${parish.slug}: ${(error as Error).message}`)
          }
          await sleep(PACE_MS)

          const hit = results.find(
            (result) =>
              inBox(result) &&
              (LOCALITY_TYPES.has(result.type) ||
                administrativeMatches(result, localityName(parish.name))),
          )
          if (hit) {
            match = { precision: 'locality', query, result: hit }
            break
          }
        }
      }

      entry = { match, reason: match ? undefined : reason }
      cache[parish.slug] = entry
      await saveCache()
    }

    if (!entry.match) {
      missed++
      misses.push(`${parish.name} — ${entry.reason ?? 'no match'}`)
      continue
    }

    const { precision, result, query } = entry.match
    const address = result.address ?? {}

    const line1 = [address.house_number, address.road].filter(Boolean).join(', ')
    const suburb = address.suburb || address.neighbourhood || address.quarter || ''

    /**
     * OSM names the municipal body, not the city: matching a Corporation zone
     * boundary returns `city: "Chennai Corporation"`, which is nobody's idea of
     * an address. The Greater Chennai Corporation governs the city of Chennai,
     * so dropping the suffix is a normalisation rather than a guess.
     */
    const city = (address.city || 'Chennai').replace(/\s+Corporation$/i, '').trim()

    const note =
      precision === 'church'
        ? `Coordinates from OpenStreetMap: "${result.display_name}" (${result.osm_type}/${result.osm_id}), matched on "${query}". OSM is crowd-sourced and the archdiocese has not published this — please confirm.`
        : `Coordinates are the centre of the locality, not the church: OpenStreetMap "${result.display_name}" (${result.osm_type}/${result.osm_id}). OSM has no church tagged for this parish. Accurate enough to sort by distance; please supply the church's own position.`

    const data: Record<string, unknown> = {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      locationPrecision: precision,
      address: {
        ...(parish.address ?? {}),
        // Street details only from an actual church match; a locality centroid
        // has no meaningful street address.
        ...(precision === 'church' && !parish.address?.line1 && line1 ? { line1 } : {}),
        ...(precision === 'church' && !parish.address?.line2 && suburb
          ? { line2: suburb }
          : {}),
        ...(parish.address?.city ? {} : { city }),
        ...(parish.address?.district || !address.state_district
          ? {}
          : { district: address.state_district }),
        ...(precision === 'church' && !parish.address?.pincode && address.postcode
          ? { pincode: address.postcode }
          : {}),
      },
      legacy: {
        ...(parish.legacy ?? {}),
        needsReview: true,
        reviewNote: [parish.legacy?.reviewNote, note].filter(Boolean).join(' '),
      },
    }

    const label = `${parish.name} -> ${result.name || result.display_name.split(',')[0]}`
    if (precision === 'church') {
      atChurch++
      churchHits.push(label)
    } else {
      atLocality++
      localityHits.push(label)
    }

    if (DRY) continue

    await payload.update({
      collection: 'parishes',
      id: parish.id,
      locale: 'en',
      data: data as never,
      context: { disableRevalidate: true },
    })
  }

  console.log(`\n  located at the church:   ${atChurch}`)
  console.log(`  located at the locality: ${atLocality}`)
  console.log(`  not located:             ${missed}`)
  console.log(`  already had coordinates: ${skipped}`)

  if (churchHits.length) {
    console.log('\n  matched an actual church:')
    for (const line of churchHits) console.log(`    ${line}`)
  }
  if (localityHits.length) {
    console.log('\n  placed at the centre of the locality (approximate, and labelled so):')
    for (const line of localityHits) console.log(`    ${line}`)
  }
  if (misses.length) {
    console.log('\n  NOT located -- left empty rather than guessed:')
    for (const line of misses) console.log(`    ${line}`)
  }

  console.log(
    `\n  All of it is flagged for review. The worksheet remains the way to get the\n  archdiocese's own addresses: npm run worksheet:export`,
  )

  if (DRY) console.log('\nDry run. Re-run without GEOCODE_DRY=1 to apply.')
  process.exit(0)
}

await main()
