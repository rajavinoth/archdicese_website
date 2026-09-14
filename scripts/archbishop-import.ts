/**
 * Loads the Archbishop page from the archdiocese's own corrected document.
 *
 * Where the data comes from
 * -------------------------
 * scripts/data/archbishop.json, extracted from Archbishop.docx, which the
 * archdiocese compiled from the old site and put back into the right order.
 * The 20 photographs travelled with it and are in scripts/data/archbishop-media/.
 *
 * Why a document rather than the migrated page
 * --------------------------------------------
 * Two sections had lost their pairing completely in the migration. The
 * Archbishops of Madras–Mylapore came through as every photograph and name
 * first, then every biography afterwards, so nothing connected a bishop to his
 * own dates. The same had happened to the conference officers. That
 * association is simply not in the migrated document any more, so no amount of
 * clever rendering recovers it — it had to come from a source that still had
 * it.
 *
 * One thing to check with the curia
 * ----------------------------------
 * The document keeps the old site's tab labels, which put the 1606-1951
 * Portuguese padroado bishops under "Former Prelates of **Madras**" and the
 * 1832-1952 bishops under "**Mylapore**". The archdiocese's own history page
 * says the opposite in three places: Mylapore was erected in 1606, the Madras
 * vicariate created in 1832, and Guerreiro — who ends the first list — is
 * "the last padroado Bishop of Mylapore".
 *
 * The document is followed here because it is what the archdiocese supplied.
 * If the curia confirms the history page is right, swapping the two labels is
 * a single edit to the `group` value on those rows in the admin.
 *
 * Run with:  npm run archbishop:import
 *            ARCHBISHOP_IMPORT_DRY=1 npm run archbishop:import
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.ARCHBISHOP_IMPORT_DRY === '1'

const DATA = path.resolve('scripts/data/archbishop.json')
const MEDIA = path.resolve('scripts/data/archbishop-media')

type Field = { label: string; values: string[] }
type Officer = { image: string | null; name: string; role: string; fields: Field[] }

type Source = {
  profile: Field[]
  history: string[]
  madras: { name: string; term: string }[]
  mylapore: { name: string; term: string }[]
  archdiocese: { image: string; name: string; details: string[] }[]
  conferences: { name: string; blurb: string; officers: Officer[] }[]
}

/** Short label for a conference tab, taken from its initials. */
const SHORT_NAMES: Record<string, string> = {
  "FEDERATION OF ASIAN BISHOPS' CONFERENCES": 'FABC',
  "CATHOLIC BISHOPS' CONFERENCE OF INDIA": 'CBCI',
  'CONFERENCE OF CATHOLIC BISHOPS OF INDIA': 'CCBI',
  'TAMIL NADU BISHOPS’ COUNCIL': 'TNBC',
}

const main = async () => {
  const payload = await getPayload({ config })
  const source = JSON.parse(await fs.readFile(DATA, 'utf8')) as Source

  /**
   * Upload each photograph once, keyed by its filename in the document so a
   * re-run reuses what is already there rather than piling up duplicates.
   */
  const uploaded = new Map<string, number | string>()

  const upload = async (filename: string, alt: string): Promise<number | string | null> => {
    if (!filename) return null
    if (uploaded.has(filename)) return uploaded.get(filename)!

    const name = `archbishop-${filename}`

    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: name } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      uploaded.set(filename, existing.docs[0].id)
      return existing.docs[0].id
    }

    if (DRY) {
      uploaded.set(filename, 0)
      return 0
    }

    const data = await fs.readFile(path.join(MEDIA, filename))
    const created = await payload.create({
      collection: 'media',
      data: { alt } as never,
      file: {
        data,
        name,
        mimetype: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
        size: data.byteLength,
      },
      context: { disableRevalidate: true },
    })

    uploaded.set(filename, created.id)
    return created.id
  }

  // ---- Prelates of the archdiocese, each with their own photograph --------
  const prelates = []
  for (const prelate of source.archdiocese) {
    prelates.push({
      name: prelate.name,
      image: await upload(prelate.image, prelate.name),
      details: prelate.details.join('\n'),
    })
  }

  // ---- Conferences and their officers ------------------------------------
  const conferences = []
  for (const conference of source.conferences) {
    const officers = []
    for (const officer of conference.officers) {
      officers.push({
        name: officer.name,
        role: officer.role,
        image: officer.image ? await upload(officer.image, officer.name) : null,
        fields: officer.fields.map((field) => ({
          label: field.label,
          value: field.values.join('\n'),
        })),
      })
    }

    conferences.push({
      name: conference.name,
      shortName: SHORT_NAMES[conference.name] ?? conference.name,
      blurb: conference.blurb,
      officers,
    })
  }

  const successions = [
    ...source.madras.map((row) => ({ group: 'madras', ...row })),
    ...source.mylapore.map((row) => ({ group: 'mylapore', ...row })),
  ]

  console.log(`  profile fields:   ${source.profile.length}`)
  console.log(`  history:          ${source.history.length} paragraphs`)
  console.log(
    `  successions:      ${source.madras.length} Madras + ${source.mylapore.length} Mylapore`,
  )
  console.log(`  prelates:         ${prelates.length}, each with a photograph`)
  console.log(
    `  conferences:      ${conferences.length} (${conferences.map((c) => `${c.shortName}: ${c.officers.length}`).join(', ')})`,
  )
  console.log(`  images uploaded:  ${uploaded.size}`)

  if (DRY) {
    console.log('\nDry run. Re-run without ARCHBISHOP_IMPORT_DRY=1 to apply.')
    process.exit(0)
  }

  /** The portrait already in the media library, from the old site's header. */
  const portrait = await payload.find({
    collection: 'media',
    where: { filename: { equals: 'bishop-speak-scaled.jpg' } },
    limit: 1,
    depth: 0,
  })

  await payload.updateGlobal({
    slug: 'archbishop-page',
    locale: 'en',
    data: {
      portrait: portrait.docs[0]?.id ?? null,
      profile: source.profile.map((field) => ({
        label: field.label,
        value: field.values.join('\n'),
      })),
      history: source.history.map((text) => ({ text })),
      successions,
      prelates,
      conferences,
    } as never,
    context: { disableRevalidate: true },
  })

  /**
   * The migrated prose page is superseded. Unpublishing rather than deleting
   * keeps the record of what the old site carried, and takes it out of the
   * sitemap and the prerendered routes — /archbishop is now served by its own
   * route, which takes precedence over the [slug] one either way.
   */
  const page = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'archbishop' } },
    limit: 1,
    depth: 0,
  })

  if (page.docs[0] && page.docs[0]._status === 'published') {
    await payload.update({
      collection: 'pages',
      id: page.docs[0].id,
      data: {
        _status: 'draft',
        legacy: {
          ...(page.docs[0].legacy ?? {}),
          needsReview: true,
          reviewNote:
            'Superseded by the structured Archbishop page (Settings → Archbishop page), which restores the photo/biography pairing the migration lost. Kept as a draft for reference.',
        },
      } as never,
      context: { disableRevalidate: true },
    })
    console.log('\n  the migrated /archbishop prose page was unpublished (kept as a draft)')
  }

  console.log('\n  Archbishop page imported.')
  process.exit(0)
}

await main()
