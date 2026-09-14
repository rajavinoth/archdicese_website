import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@payload-config'

import { JsonLd } from '@/components/JsonLd'
import { formatClergyName } from '@/lib/clergy'
import {
  dayLabel,
  formatTime,
  groupByDay,
  kindLabel,
  languageLabel,
  type Service,
} from '@/lib/services'
import {
  DEFAULT_LOCALE,
  LOCALES,
  getDictionary,
  isLocale,
  localePath,
  type Locale, alternatesFor, fill } from '@/lib/i18n'
import { breadcrumbSchema, churchSchema, graph } from '@/lib/structured-data'

/** Fetch once, reuse for both the metadata and the page body. */
const getParish = async (slug: string, locale: Locale) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'parishes',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    locale,
  })
  return result.docs[0] ?? null
}

/** Prerender every parish page at build time. */
export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'parishes',
    limit: 1000,
    pagination: false,
  })
  return LOCALES.flatMap((locale) =>
    result.docs.map((parish) => ({ locale, slug: parish.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/parishes/[slug]'>): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const parish = await getParish(slug, locale)
  if (!parish) return { title: 'Parish not found' }

  // Most parishes have neither patron nor city yet, and joining empties left a
  // description that began with a dangling em dash.
  const place = [parish.patron, parish.address?.city].filter(Boolean).join(', ')

  return {
    title: parish.name,
    description: place
      ? `${parish.name} (${place}) — mass timings and contact details.`
      : `${parish.name}, Archdiocese of Madras-Mylapore — mass timings and contact details.`,
    alternates: alternatesFor(`/parishes/${slug}`, locale),
  }
}

export default async function ParishPage({ params }: PageProps<'/[locale]/parishes/[slug]'>) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const parish = await getParish(slug, locale)

  if (!parish) notFound()

  const deanery =
    typeof parish.deanery === 'object' && parish.deanery !== null ? parish.deanery : null

  const priest =
    typeof parish.parishPriest === 'object' && parish.parishPriest !== null
      ? parish.parishPriest
      : null

  const assistants = (parish.assistantPriests ?? []).filter(
    (entry): entry is Exclude<typeof entry, number> => typeof entry === 'object',
  )

  const byDay = groupByDay((parish.services ?? []) as Service[])

  const addressLines = [
    parish.address?.line1,
    parish.address?.line2,
    [parish.address?.city, parish.address?.pincode].filter(Boolean).join(' '),
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <JsonLd
        data={graph(
          churchSchema(parish, locale),
          breadcrumbSchema(
            [
              { name: t.siteName, path: '/' },
              { name: t.nav.parishes, path: '/parishes' },
              { name: parish.name, path: `/parishes/${slug}` },
            ],
            locale,
          ),
        )}
      />

      <p className="text-sm text-slate-500">
        <Link href={localePath('/parishes', locale)} className="hover:underline">
          {t.nav.parishes}
        </Link>
        {deanery && <> · {deanery.name}</>}
      </p>

      <header className="mt-3">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{parish.name}</h1>
          {parish.isShrine && (
            <span className="mt-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {t.parishes.shrine}
            </span>
          )}
        </div>
        {parish.patron && (
          <p className="mt-2 text-slate-600">Dedicated to {parish.patron}</p>
        )}
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-3">
        {/* Timings */}
        <section className="md:col-span-2">
          <h2 className="text-lg font-semibold">{t.parishes.timings}</h2>

          {/*
            Invented timings must never be mistaken for the real schedule. The
            warning sits above the table rather than below it, and is styled as
            a warning rather than a footnote, because somebody scanning for a
            mass time will read the first thing under the heading and stop.
          */}
          {parish.timingsAreSample && byDay.length > 0 && (
            <div className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {t.parishes.sampleTimingsTitle}
              </p>
              <p className="mt-1 text-sm text-amber-900">
                {t.parishes.sampleTimingsBody}
              </p>
            </div>
          )}

          {byDay.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              {t.parishes.noTimings}
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {byDay.map(({ day, services }) => (
                <div key={day}>
                  <h3 className="text-sm font-medium text-slate-900">
                    {dayLabel(day, locale)}
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                    {services.map((service, index) => (
                      <li
                        key={index}
                        className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm"
                      >
                        <span className="w-20 font-medium tabular-nums">
                          {formatTime(service.time, locale)}
                        </span>
                        <span className="text-slate-700">
                          {kindLabel(service.kind, locale)}
                        </span>
                        {service.language && (
                          <span className="text-slate-500">
                            {languageLabel(service.language, locale)}
                          </span>
                        )}
                        {service.note && (
                          <span className="text-slate-400">{service.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {parish.history && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold">{t.parishes.history}</h2>
              <div className="prose prose-slate mt-3 max-w-none text-slate-700">
                <RichText data={parish.history} />
              </div>
            </div>
          )}
        </section>

        {/* Contact sidebar */}
        <aside className="space-y-6 text-sm">
          {addressLines.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-900">{t.parishes.address}</h2>
              <address className="mt-2 not-italic text-slate-600">
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
          )}

          {(parish.phone || parish.email) && (
            <div>
              <h2 className="font-semibold text-slate-900">{t.parishes.contact}</h2>
              <ul className="mt-2 space-y-1 text-slate-600">
                {parish.phone && (
                  <li>
                    <a href={`tel:${parish.phone}`} className="hover:underline">
                      {parish.phone}
                    </a>
                  </li>
                )}
                {parish.email && (
                  <li>
                    <a href={`mailto:${parish.email}`} className="hover:underline">
                      {parish.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {(priest || assistants.length > 0) && (
            <div>
              <h2 className="font-semibold text-slate-900">{t.parishes.clergy}</h2>
              <ul className="mt-2 space-y-1 text-slate-600">
                {priest && (
                  <li>
                    <Link href={`${localePath('/clergy', locale)}/${priest.slug}`} className="hover:underline">
                      {formatClergyName(priest.honorific, priest.name)}
                    </Link>
                    <span className="block text-xs text-slate-400">{t.parishes.parishPriest}</span>
                  </li>
                )}
                {assistants.map((assistant) => (
                  <li key={assistant.id}>
                    <Link href={`${localePath('/clergy', locale)}/${assistant.slug}`} className="hover:underline">
                      {formatClergyName(assistant.honorific, assistant.name)}
                    </Link>
                    <span className="block text-xs text-slate-400">{t.parishes.assistant}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parish.latitude != null && parish.longitude != null && (
            <div>
              <h2 className="font-semibold text-slate-900">{t.parishes.gettingThere}</h2>
              <a
                href={`https://www.openstreetmap.org/?mlat=${parish.latitude}&mlon=${parish.longitude}#map=17/${parish.latitude}/${parish.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-brand-700 underline hover:text-brand-900"
              >
                {t.parishes.viewOnMap}
              </a>
              {/*
                Most parishes could only be placed at the centre of their
                locality -- OpenStreetMap has barely thirty Catholic churches
                tagged across the whole archdiocese. A pin that is a few hundred
                metres out is useful for getting close; presenting it as the
                church door would not be.
              */}
              {parish.locationPrecision === 'locality' && (
                <p className="mt-2 text-xs text-slate-500">
                  {fill(t.parishes.approximateLocation, { place: parish.name })}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
