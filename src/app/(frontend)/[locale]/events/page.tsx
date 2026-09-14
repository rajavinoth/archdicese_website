import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { formatEventDate, monthKey } from '@/lib/events'
import { LOCALES, fill, getDictionary, isLocale, localePath, alternatesFor } from '@/lib/i18n'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return {
    title: t.events.title,
    description: t.events.intro,
    alternates: alternatesFor('/events', locale),
  }
}

type EventRow = {
  id: string
  slug: string
  title: string
  startDate: string
  allDay: boolean
  location: string | null
}

/** Group a sorted list into month headings. */
const groupByMonth = (events: EventRow[], locale: string) => {
  const groups: { month: string; events: EventRow[] }[] = []

  for (const event of events) {
    const month = monthKey(event.startDate, locale)
    const last = groups.at(-1)
    if (last?.month === month) last.events.push(event)
    else groups.push({ month, events: [event] })
  }

  return groups
}

export default async function EventsPage({ params }: PageProps<'/[locale]/events'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const now = new Date().toISOString()

  // Two queries so upcoming events lead, and the archive reads backwards.
  const [upcoming, past] = await Promise.all([
    payload.find({
      overrideAccess: false,
      collection: 'events',
      where: { startDate: { greater_than_equal: now } },
      sort: 'startDate',
      limit: 200,
      depth: 0,
      locale,
    }),
    payload.find({
      overrideAccess: false,
      collection: 'events',
      where: { startDate: { less_than: now } },
      sort: '-startDate',
      limit: 200,
      depth: 0,
      locale,
    }),
  ])

  const toRow = (doc: {
    id: string | number
    slug: string
    title: string
    startDate: string
    allDay?: boolean | null
    location?: string | null
  }): EventRow => ({
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
    startDate: doc.startDate,
    allDay: Boolean(doc.allDay),
    location: doc.location ?? null,
  })

  const upcomingRows = upcoming.docs.map(toRow)
  const pastRows = past.docs.map(toRow)

  const renderList = (events: EventRow[]) => (
    <div className="mt-4 space-y-8">
      {groupByMonth(events, locale).map((group) => (
        <div key={group.month}>
          <h3 className="text-sm font-medium text-slate-500">{group.month}</h3>
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {group.events.map((event) => (
              <li key={event.id} className="py-3">
                <p className="text-xs text-slate-500">
                  {formatEventDate(event.startDate, event.allDay, locale)}
                </p>
                <h4 className="mt-0.5 font-medium">
                  <Link href={`${localePath('/events', locale)}/${event.slug}`} className="hover:underline">
                    {event.title}
                  </Link>
                </h4>
                {event.location && (
                  <p className="mt-0.5 text-sm text-slate-600">{event.location}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t.events.title}</h1>
        <p className="mt-3 text-slate-600">{t.events.intro}</p>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.events.upcoming}</h2>
        {upcomingRows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            {t.events.none}
          </p>
        ) : (
          renderList(upcomingRows)
        )}
      </section>

      {pastRows.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">{t.events.past}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {fill(t.events.carriedOver, { count: pastRows.length })}
          </p>
          {renderList(pastRows)}
        </section>
      )}
    </div>
  )
}
