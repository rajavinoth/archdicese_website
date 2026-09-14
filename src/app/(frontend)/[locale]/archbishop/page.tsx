import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { JsonLd } from '@/components/JsonLd'
import { Tabs, type Tab } from '@/components/Tabs'
import { LOCALES, alternatesFor, getDictionary, isLocale } from '@/lib/i18n'
import { breadcrumbSchema, graph, ORGANIZATION_ID } from '@/lib/structured-data'

/**
 * The Archbishop page.
 *
 * A real route rather than a CMS page, because the content is five unrelated
 * structured things — see src/globals/ArchbishopPage.ts for why it could not
 * stay as migrated prose. This route also takes precedence over `[slug]`, so
 * the old URL keeps working.
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/archbishop'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.archbishop.title,
    description: t.archbishop.intro,
    alternates: alternatesFor('/archbishop', locale),
  }
}

/** A label/value row, the shape used by the profile and by every officer. */
const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-1 gap-x-6 border-b border-brand-50 py-2.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
    <dt className="text-xs font-semibold tracking-wide text-brand-500 uppercase sm:pt-0.5">
      {label}
    </dt>
    <dd className="m-0 text-slate-700">
      {value.split('\n').map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </dd>
  </div>
)

/** Name and term, the shape of both succession lists. */
const SuccessionList = ({ rows }: { rows: { name: string; term?: string | null }[] }) => (
  <ol className="mt-2">
    {rows.map((row, index) => (
      <li
        key={index}
        className="flex items-baseline justify-between gap-4 border-b border-brand-50 py-2.5 last:border-0"
      >
        <span className="text-slate-800">{row.name}</span>
        {row.term && (
          <span className="shrink-0 text-sm tabular-nums text-brand-500">{row.term}</span>
        )}
      </li>
    ))}
  </ol>
)

type MediaLike = { url?: string | null; alt?: string | null; width?: number | null; height?: number | null }

const imageOf = (value: unknown): MediaLike | null =>
  typeof value === 'object' && value !== null && 'url' in value ? (value as MediaLike) : null

export default async function ArchbishopRoute({
  params,
}: PageProps<'/[locale]/archbishop'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const page = await payload.findGlobal({ slug: 'archbishop-page', depth: 1, locale })

  const portrait = imageOf(page.portrait)
  const madras = (page.successions ?? []).filter((row) => row.group === 'madras')
  const mylapore = (page.successions ?? []).filter((row) => row.group === 'mylapore')

  // ---- Profile tab -------------------------------------------------------
  const profileTab = (
    <div>
      {portrait?.url && (
        <Image
          src={portrait.url}
          alt={portrait.alt ?? ''}
          width={portrait.width ?? 1600}
          height={portrait.height ?? 900}
          className="mb-8 aspect-[21/9] w-full rounded-xl object-cover"
          priority
        />
      )}

      <dl className="rounded-xl border border-brand-100 bg-white px-5 py-1 shadow-sm">
        {(page.profile ?? []).map((field, index) => (
          <FieldRow key={index} label={field.label} value={field.value} />
        ))}
      </dl>

      {(page.history ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight text-brand-900">
            {t.archbishop.history}
          </h2>
          <div className="prose prose-slate prose-page mt-4 max-w-none">
            {(page.history ?? []).map((entry, index) => (
              <p key={index}>{entry.text}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  // ---- Prelate cards -----------------------------------------------------
  const prelatesTab = (
    <ul className="grid gap-5 sm:grid-cols-2">
      {(page.prelates ?? []).map((prelate, index) => {
        const image = imageOf(prelate.image)

        return (
          <li
            key={index}
            className="flex gap-4 rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
          >
            {image?.url && (
              <Image
                src={image.url}
                alt={prelate.name}
                width={image.width ?? 200}
                height={image.height ?? 260}
                className="h-28 w-24 shrink-0 rounded-lg object-cover ring-1 ring-brand-100"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-wide text-brand-900 uppercase">
                {prelate.name}
              </h3>
              {prelate.details && (
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {prelate.details.split('\n').filter(Boolean).map((line, position) => (
                    <li key={position}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )

  // ---- Conferences, each its own nested tab ------------------------------
  const conferenceTabs: Tab[] = (page.conferences ?? []).map((conference, index) => ({
    id: `conference-${index}`,
    label: conference.shortName || conference.name,
    content: (
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-brand-900">
          {conference.name}
        </h3>
        {conference.blurb && (
          <p className="mt-3 max-w-3xl text-slate-600">{conference.blurb}</p>
        )}

        <ul className="mt-6 grid gap-5 lg:grid-cols-2">
          {(conference.officers ?? []).map((officer, position) => {
            const image = imageOf(officer.image)

            return (
              <li
                key={position}
                className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {image?.url && (
                    <Image
                      src={image.url}
                      alt={officer.name}
                      width={image.width ?? 200}
                      height={image.height ?? 260}
                      className="h-20 w-16 shrink-0 rounded-lg object-cover ring-1 ring-brand-100"
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-brand-900">{officer.name}</h4>
                    {officer.role && (
                      <p className="mt-0.5 text-sm text-brand-600">{officer.role}</p>
                    )}
                  </div>
                </div>

                {(officer.fields ?? []).length > 0 && (
                  <dl className="mt-4">
                    {(officer.fields ?? []).map((field, fieldIndex) => (
                      <FieldRow key={fieldIndex} label={field.label} value={field.value} />
                    ))}
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    ),
  }))

  // ---- The page's own tabs ----------------------------------------------
  const tabs: Tab[] = [
    { id: 'profile', label: t.archbishop.tabProfile, content: profileTab },
    ...(madras.length
      ? [{ id: 'madras', label: t.archbishop.tabMadras, content: <SuccessionList rows={madras} /> }]
      : []),
    ...(mylapore.length
      ? [
          {
            id: 'mylapore',
            label: t.archbishop.tabMylapore,
            content: <SuccessionList rows={mylapore} />,
          },
        ]
      : []),
    ...((page.prelates ?? []).length
      ? [{ id: 'prelates', label: t.archbishop.tabPrelates, content: prelatesTab }]
      : []),
    ...(conferenceTabs.length
      ? [
          {
            id: 'conference',
            label: t.archbishop.tabConference,
            content: (
              <Tabs
                tabs={conferenceTabs}
                label={t.archbishop.conferenceTabsLabel}
                variant="nested"
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <JsonLd
        data={graph(
          {
            '@type': 'Person',
            name: 'Most Rev. George Antonysamy',
            jobTitle: 'Archbishop of Madras-Mylapore',
            affiliation: { '@id': ORGANIZATION_ID },
          },
          breadcrumbSchema(
            [
              { name: t.siteName, path: '/' },
              { name: t.archbishop.title, path: '/archbishop' },
            ],
            locale,
          ),
        )}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
          {t.archbishop.title}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t.archbishop.intro}</p>
      </header>

      <Tabs tabs={tabs} label={t.archbishop.tabsLabel} />
    </div>
  )
}
