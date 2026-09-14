import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@payload-config'

import { JsonLd } from '@/components/JsonLd'
import { formatEventDate } from '@/lib/events'
import { DEFAULT_LOCALE, LOCALES, getDictionary, isLocale, localePath, type Locale, alternatesFor } from '@/lib/i18n'
import { breadcrumbSchema, eventSchema, graph } from '@/lib/structured-data'

const getEvent = async (slug: string, locale: Locale) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'events',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    locale,
  })
  return result.docs[0] ?? null
}

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'events',
    limit: 1000,
    pagination: false,
  })
  return LOCALES.flatMap((locale) =>
    result.docs.map((event) => ({ locale, slug: event.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events/[slug]'>): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const event = await getEvent(slug, locale)
  if (!event) return { title: 'Event not found' }

  return {
    title: event.title,
    description: [formatEventDate(event.startDate, Boolean(event.allDay), locale), event.location]
      .filter(Boolean)
      .join(' — '),
    alternates: alternatesFor(`/events/${slug}`, locale),
  }
}

export default async function EventPage({ params }: PageProps<'/[locale]/events/[slug]'>) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const event = await getEvent(slug, locale)

  if (!event) notFound()

  const parish =
    typeof event.parish === 'object' && event.parish !== null ? event.parish : null

  const start = formatEventDate(event.startDate, Boolean(event.allDay), locale)
  const end = event.endDate ? formatEventDate(event.endDate, Boolean(event.allDay), locale) : null

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <JsonLd
        data={graph(
          eventSchema(event, locale),
          breadcrumbSchema(
            [
              { name: t.siteName, path: '/' },
              { name: t.events.title, path: '/events' },
              { name: event.title, path: `/events/${slug}` },
            ],
            locale,
          ),
        )}
      />

      <p className="text-sm text-slate-500">
        <Link href={localePath('/events', locale)} className="hover:underline">
          {t.events.title}
        </Link>
      </p>

      <header className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
      </header>

      <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{t.events.when}</dt>
          <dd className="mt-0.5">
            {start}
            {/* A one-day all-day event ends at the next midnight, which is not
                worth showing as a second date. */}
            {end && end !== start && !event.allDay && <> — {end}</>}
          </dd>
        </div>

        {event.location && (
          <div>
            <dt className="text-slate-500">{t.events.where}</dt>
            <dd className="mt-0.5">{event.location}</dd>
          </div>
        )}

        {parish && (
          <div>
            <dt className="text-slate-500">{t.clergy.parish}</dt>
            <dd className="mt-0.5">
              <Link href={`${localePath('/parishes', locale)}/${parish.slug}`} className="hover:underline">
                {parish.name}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {event.description && (
        <div className="prose prose-slate mt-8 max-w-none text-slate-700">
          <RichText data={event.description} />
        </div>
      )}
    </article>
  )
}
