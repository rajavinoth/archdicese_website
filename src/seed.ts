import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Development seed.
 *
 * The priest NAMES below are real, taken from the public pages of the current
 * archdiocesan website. Mass timings and coordinates are PLACEHOLDER DATA
 * invented to exercise the UI and must be replaced from the curia's own
 * records before launch.
 *
 * Deaneries are NOT seeded here. They are real data from the 2026 appointments
 * letter and are applied by `npm run deaneries:apply`. This script used to
 * invent three of them and then assign every priest and parish to one at
 * random, which put fabricated information on a diocesan website -- see
 * scripts/deaneries-apply.ts.
 *
 * Run with:  npm run seed
 */

/** Real slugs scraped from the live site's sitemap (47 profiles, A-H only). */
const CLERGY_SLUGS = [
  'a-amal-raj',
  'albert-benedict-nathan-r',
  'albert-jude-j',
  'alexander-a',
  'ambrose-c-c',
  'andrew-dominic',
  'anthony-b',
  'anthony-raj-b-i',
  'anthony-raj-t',
  'anthony-raj-v',
  'anthonysamy-g-j',
  'antony-doss-l',
  'arokia-velankanni-stalin',
  'arokiaraj-r',
  'arokiaraj-y-s',
  'arputhasamy-m-s',
  'arul-jesu-doss-k',
  'arul-raj-d',
  'arul-selvam-d',
  'arulappa-e',
  'arun-durai-a',
  'asir-arputharajan-d',
  'austin-jose-albert-d',
  'balasamy-m',
  'balraj-s',
  'benjamin-soosai-s',
  'bernard-lawrence',
  'bosco-y-f',
  'charles-anandaraj-f',
  'charles-david-immanuel',
  'charles-kumar-n-a',
  'charles-p',
  'chinnappa-carasala',
  'christhu-raj-o-j',
  'clement-balasamy-t',
  'edward-raj-s',
  'edward-santhosh-kumar-m',
  'edward-selvaraj-j',
  'eucharist-f-j-x',
  'felix-philip',
  'francis-michael',
  'geo-patrick',
  'gerard-majella-d',
  'gilbert-joe',
  'greith-mathews-t',
  'henry-felix-a',
]

/**
 * "a-amal-raj"                -> "A. Amal Raj"
 * "albert-benedict-nathan-r"  -> "Albert Benedict Nathan R."
 * Single-letter parts are initials and get a full stop.
 */
const slugToName = (slug: string): string =>
  slug
    .split('-')
    .map((part) =>
      part.length === 1
        ? `${part.toUpperCase()}.`
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ')

const PARISHES = [
  {
    name: 'San Thome Cathedral Basilica',
    slug: 'san-thome-cathedral-basilica',
    patron: 'St Thomas the Apostle',
    isShrine: true,
    latitude: 13.0336,
    longitude: 80.2783,
    city: 'Chennai',
  },
  {
    name: "St Mark's Catholic Church",
    slug: 'st-marks-catholic-church',
    patron: 'St Mark',
    isShrine: false,
    latitude: 13.0827,
    longitude: 80.2707,
    city: 'Chennai',
  },
  {
    name: 'St Louis Church',
    slug: 'st-louis-church',
    patron: 'St Louis',
    isShrine: false,
    latitude: 13.0674,
    longitude: 80.2376,
    city: 'Chennai',
  },
  {
    name: 'Our Lady of Visitation Church',
    slug: 'our-lady-of-visitation-church',
    patron: 'Our Lady of the Visitation',
    isShrine: false,
    latitude: 13.0524,
    longitude: 80.2508,
    city: 'Chennai',
  },
]

const seed = async () => {
  const payload = await getPayload({ config })

  payload.logger.info('--- Seeding development data (PLACEHOLDER, not real records) ---')

  // ---- Admin user -------------------------------------------------------
  const existingUsers = await payload.count({ collection: 'users' })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'Site Administrator',
        email: 'admin@example.com',
        password: 'changeme123',
        roles: ['admin'],
      },
      context: { disableRevalidate: true },
    })
    payload.logger.info('Created admin -> admin@example.com / changeme123')
  } else {
    payload.logger.info('Users already exist, skipping admin creation.')
  }

  // ---- Deaneries --------------------------------------------------------
  /**
   * Deaneries come from `npm run deaneries:apply` (the 2026 appointments
   * letter), not from here.
   */
  const deaneryCount = await payload.count({ collection: 'deaneries' })
  payload.logger.info(
    `Deaneries present: ${deaneryCount.totalDocs} (run "npm run deaneries:apply" if 0)`,
  )

  // ---- Clergy -----------------------------------------------------------
  const clergyIds: number[] = []
  for (const [index, slug] of CLERGY_SLUGS.entries()) {
    const found = await payload.find({
      collection: 'clergy',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    if (found.docs.length > 0) {
      clergyIds.push(Number(found.docs[0].id))
      continue
    }

    const created = await payload.create({
      collection: 'clergy',
      data: {
        honorific: 'fr',
        name: slugToName(slug),
        slug,
        status: 'active',
        languages: index % 3 === 0 ? ['tamil', 'english'] : ['tamil'],
        contactPublic: false,
        _status: 'published',
      },
      context: { disableRevalidate: true },
    })
    clergyIds.push(Number(created.id))
  }
  payload.logger.info(`Clergy ready: ${clergyIds.length}`)

  // ---- Parishes ---------------------------------------------------------
  for (const [index, parish] of PARISHES.entries()) {
    const found = await payload.find({
      collection: 'parishes',
      where: { slug: { equals: parish.slug } },
      limit: 1,
    })
    if (found.docs.length > 0) continue

    await payload.create({
      collection: 'parishes',
      data: {
        name: parish.name,
        slug: parish.slug,
        patron: parish.patron,
        isShrine: parish.isShrine,
        parishPriest: clergyIds[index],
        latitude: parish.latitude,
        longitude: parish.longitude,
        address: { city: parish.city, district: 'Chennai' },
        // PLACEHOLDER timings, purely to exercise the finder UI.
        services: [
          {
            kind: 'mass',
            day: 'sunday',
            time: new Date('2026-01-01T06:00:00').toISOString(),
            language: 'tamil',
          },
          {
            kind: 'mass',
            day: 'sunday',
            time: new Date('2026-01-01T08:30:00').toISOString(),
            language: 'english',
          },
          {
            kind: 'mass',
            day: 'saturday',
            time: new Date('2026-01-01T18:00:00').toISOString(),
            language: 'tamil',
            note: 'Vigil',
          },
        ],
        _status: 'published',
      },
      context: { disableRevalidate: true },
    })
  }
  payload.logger.info(`Parishes ready: ${PARISHES.length}`)

  payload.logger.info('--- Seed complete ---')
}

// Top-level await, so `payload run` does not exit before the work finishes.
await seed()
process.exit(0)
