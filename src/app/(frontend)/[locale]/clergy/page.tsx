import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ClergyDirectory } from '@/components/ClergyDirectory'
import type { ClergyMember, DeaneryOption } from '@/components/ClergyDirectory'
import { LOCALES, getDictionary, isLocale, localePath, alternatesFor } from '@/lib/i18n'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/clergy'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return {
    title: t.clergy.title,
    description: t.clergy.intro,
    alternates: alternatesFor('/clergy', locale),
  }
}

/**
 * This is a Server Component. Note there is no useEffect and no loading state:
 * we talk to the database directly and `await` the result, so the HTML Google
 * and the browser receive is already filled in.
 *
 * The interactive search box lives in ClergyDirectory, which is a Client
 * Component. That split is the only real structural difference from the plain
 * React you already write.
 */
export default async function ClergyPage({ params }: PageProps<'/[locale]/clergy'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  // getPayload talks to the database in-process -- no HTTP round trip.
  const [clergyResult, deaneryResult] = await Promise.all([
    payload.find({
      overrideAccess: false,
      collection: 'clergy',
      limit: 500,
      sort: 'name',
      depth: 1, // resolve the deanery relationship one level deep
      locale,
    }),
    payload.find({
      overrideAccess: false,
      collection: 'deaneries',
      limit: 50,
      sort: 'name',
      locale,
    }),
  ])

  const clergy: ClergyMember[] = clergyResult.docs.map((priest) => {
    const deanery =
      typeof priest.deanery === 'object' && priest.deanery !== null
        ? { id: String(priest.deanery.id), name: priest.deanery.name }
        : null

    const photo =
      typeof priest.photo === 'object' && priest.photo !== null
        ? {
            // Prefer the generated thumbnail over the full-size original.
            url: priest.photo.sizes?.thumbnail?.url ?? priest.photo.url ?? null,
            alt: priest.photo.alt ?? priest.name,
          }
        : null

    return {
      id: String(priest.id),
      slug: priest.slug,
      photo: photo?.url ? { url: photo.url, alt: photo.alt } : null,
      name: priest.name,
      honorific: priest.honorific,
      status: priest.status,
      currentAssignment: priest.currentAssignment ?? null,
      languages: priest.languages ?? [],
      deanery,
    }
  })

  const deaneries: DeaneryOption[] = deaneryResult.docs.map((deanery) => ({
    id: String(deanery.id),
    name: deanery.name,
  }))

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t.clergy.title}</h1>
        <p className="mt-3 text-slate-600">{t.clergy.intro}</p>
      </header>

      <ClergyDirectory
        clergy={clergy}
        deaneries={deaneries}
        basePath={localePath('/clergy', locale)}
        labels={{
          searchLabel: t.clergy.searchLabel,
          searchPlaceholder: t.clergy.searchPlaceholder,
          deanery: t.clergy.deanery,
          allDeaneries: t.common.allDeaneries,
          status: t.clergy.status,
          anyStatus: t.clergy.anyStatus,
          active: t.clergy.active,
          retired: t.clergy.retired,
          away: t.clergy.away,
          onLeave: t.clergy.onLeave,
          deceased: t.clergy.deceased,
          showing: t.common.showing,
          priests: t.home.statPriests,
          noResults: t.common.noResults,
        }}
      />
    </div>
  )
}
