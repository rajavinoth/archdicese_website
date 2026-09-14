import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@payload-config'

import { JsonLd } from '@/components/JsonLd'
import { languageLabel } from '@/lib/services'
import { formatClergyName } from '@/lib/clergy'
import { DEFAULT_LOCALE, LOCALES, getDictionary, isLocale, localePath, type Locale, alternatesFor } from '@/lib/i18n'
import { breadcrumbSchema, graph, personSchema } from '@/lib/structured-data'

const getPriest = async (slug: string, locale: Locale) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'clergy',
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
    collection: 'clergy',
    limit: 1000,
    pagination: false,
  })
  return LOCALES.flatMap((locale) =>
    result.docs.map((priest) => ({ locale, slug: priest.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/clergy/[slug]'>): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const priest = await getPriest(slug, locale)
  if (!priest) return { title: 'Priest not found' }

  return {
    title: formatClergyName(priest.honorific, priest.name),
    description:
      priest.currentAssignment ??
      'A priest of the Archdiocese of Madras-Mylapore.',
    alternates: alternatesFor(`/clergy/${slug}`, locale),
  }
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

export default async function ClergyMemberPage({
  params,
}: PageProps<'/[locale]/clergy/[slug]'>) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const priest = await getPriest(slug, locale)

  if (!priest) notFound()

  const deanery =
    typeof priest.deanery === 'object' && priest.deanery !== null
      ? priest.deanery
      : null

  const parish =
    typeof priest.parish === 'object' && priest.parish !== null ? priest.parish : null

  const photo =
    typeof priest.photo === 'object' && priest.photo !== null ? priest.photo : null

  const ordained = formatDate(priest.ordinationDate)
  const history = priest.assignmentHistory ?? []

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <JsonLd
        data={graph(
          personSchema(priest, locale),
          breadcrumbSchema(
            [
              { name: t.siteName, path: '/' },
              { name: t.clergy.title, path: '/clergy' },
              { name: priest.name, path: `/clergy/${slug}` },
            ],
            locale,
          ),
        )}
      />

      <p className="text-sm text-slate-500">
        <Link href={localePath('/clergy', locale)} className="hover:underline">
          {t.clergy.title}
        </Link>
      </p>

      <header className="mt-3 flex flex-wrap items-start gap-6">
        {photo?.url && (
          <Image
            src={photo.sizes?.card?.url ?? photo.url}
            alt={photo.alt ?? priest.name}
            width={160}
            height={160}
            className="h-40 w-40 shrink-0 rounded-lg object-cover"
            priority
          />
        )}

        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">
            {formatClergyName(priest.honorific, priest.name)}
          </h1>

          {priest.currentAssignment && (
            <p className="mt-2 text-slate-600">{priest.currentAssignment}</p>
          )}

          {priest.status !== 'active' && (
            <p className="mt-3 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {
              {
                active: t.clergy.active,
                retired: t.clergy.retired,
                away: t.clergy.away,
                onLeave: t.clergy.onLeave,
                deceased: t.clergy.deceased,
              }[priest.status]
            }
            </p>
          )}
        </div>
      </header>

      <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
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

        {deanery && (
          <div>
            <dt className="text-slate-500">{t.clergy.deanery}</dt>
            <dd className="mt-0.5">{deanery.name}</dd>
          </div>
        )}

        {ordained && (
          <div>
            <dt className="text-slate-500">{t.clergy.ordained}</dt>
            <dd className="mt-0.5">{ordained}</dd>
          </div>
        )}

        {priest.languages && priest.languages.length > 0 && (
          <div>
            <dt className="text-slate-500">{t.clergy.languages}</dt>
            <dd className="mt-0.5">
              {priest.languages
                .map((language) => languageLabel(language, locale))
                .join(', ')}
            </dd>
          </div>
        )}

        {/* Contact details are hidden unless the priest has opted in. */}
        {priest.contactPublic && priest.email && (
          <div>
            <dt className="text-slate-500">{t.clergy.email}</dt>
            <dd className="mt-0.5">
              <a href={`mailto:${priest.email}`} className="hover:underline">
                {priest.email}
              </a>
            </dd>
          </div>
        )}

        {priest.contactPublic && priest.phone && (
          <div>
            <dt className="text-slate-500">{t.clergy.phone}</dt>
            <dd className="mt-0.5">
              <a href={`tel:${priest.phone}`} className="hover:underline">
                {priest.phone}
              </a>
            </dd>
          </div>
        )}

        {priest.contactPublic && priest.residenceAddress && (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">{t.clergy.addressLabel}</dt>
            <dd className="mt-0.5 whitespace-pre-line">{priest.residenceAddress}</dd>
          </div>
        )}
      </dl>

      {priest.bio && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t.clergy.biography}</h2>
          <div className="prose prose-slate mt-3 max-w-none text-slate-700">
            <RichText data={priest.bio} />
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t.clergy.previousAssignments}</h2>
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {history.map((entry) => (
              <li key={entry.id ?? entry.role} className="py-2">
                <span className="font-medium">{entry.role}</span>
                {entry.place && <span className="text-slate-600"> · {entry.place}</span>}
                {(entry.from || entry.to) && (
                  <span className="block text-xs text-slate-400">
                    {[formatDate(entry.from), formatDate(entry.to) ?? t.clergy.present]
                      .filter(Boolean)
                      .join(' — ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
