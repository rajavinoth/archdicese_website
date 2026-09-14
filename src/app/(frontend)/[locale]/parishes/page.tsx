import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ParishFinder } from '@/components/ParishFinder'
import type { DeaneryOption, ParishSummary } from '@/components/ParishFinder'
import { formatClergyName } from '@/lib/clergy'
import type { Service } from '@/lib/services'
import { LOCALES, getDictionary, isLocale, localePath, alternatesFor } from '@/lib/i18n'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/parishes'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return {
    title: t.parishes.title,
    description: t.parishes.intro,
    alternates: alternatesFor('/parishes', locale),
  }
}

export default async function ParishesPage({
  params,
}: PageProps<'/[locale]/parishes'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const [parishResult, deaneryResult] = await Promise.all([
    payload.find({
      overrideAccess: false,
      collection: 'parishes',
      limit: 500,
      sort: 'name',
      depth: 1, // resolve deanery and parishPriest
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

  const parishes: ParishSummary[] = parishResult.docs.map((parish) => {
    const deanery =
      typeof parish.deanery === 'object' && parish.deanery !== null
        ? { id: String(parish.deanery.id), name: parish.deanery.name }
        : null

    const priest =
      typeof parish.parishPriest === 'object' && parish.parishPriest !== null
        ? formatClergyName(parish.parishPriest.honorific, parish.parishPriest.name)
        : null

    return {
      id: String(parish.id),
      slug: parish.slug,
      name: parish.name,
      patron: parish.patron ?? null,
      isShrine: Boolean(parish.isShrine),
      latitude: parish.latitude ?? null,
      longitude: parish.longitude ?? null,
      city: parish.address?.city ?? null,
      deanery,
      priestName: priest,
      services: (parish.services ?? []) as Service[],
      timingsAreSample: Boolean(parish.timingsAreSample),
    }
  })

  const deaneries: DeaneryOption[] = deaneryResult.docs.map((deanery) => ({
    id: String(deanery.id),
    name: deanery.name,
  }))

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t.parishes.title}</h1>
        <p className="mt-3 text-slate-600">{t.parishes.intro}</p>
      </header>

      <ParishFinder
        parishes={parishes}
        deaneries={deaneries}
        basePath={localePath('/parishes', locale)}
        locale={locale}
        labels={{
          search: t.common.search,
          searchPlaceholder: t.parishes.searchPlaceholder,
          deanery: t.clergy.deanery,
          allDeaneries: t.common.allDeaneries,
          massLanguage: t.parishes.massLanguage,
          anyLanguage: t.common.anyLanguage,
          day: t.parishes.day,
          anyDay: t.common.anyDay,
          time: t.parishes.time,
          anyTime: t.common.anyTime,
          findNearMe: t.parishes.findNearMe,
          locating: t.parishes.locating,
          locationSet: t.parishes.locationSet,
          shrinesOnly: t.parishes.shrinesOnly,
          showMap: t.parishes.showMap,
          hideMap: t.parishes.hideMap,
          shrine: t.parishes.shrine,
          showing: t.common.showing,
          parishesNoun: t.nav.parishes,
          noneMatch: t.parishes.noneMatch,
          sampleTimingsTitle: t.parishes.sampleTimingsTitle,
          sampleTimingsBody: t.parishes.sampleTimingsBody,
        }}
      />
    </div>
  )
}
