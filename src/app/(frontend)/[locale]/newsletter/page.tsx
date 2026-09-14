import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { DocumentList, type DocumentCard } from '@/components/DocumentList'
import { Tabs, type Tab } from '@/components/Tabs'
import { LOCALES, alternatesFor, fill, getDictionary, isLocale } from '@/lib/i18n'

/**
 * The newsletter archive.
 *
 * A real route rather than a CMS page. What it replaces was the wreckage of a
 * WordPress tab plugin: eight year labels stranded in a list followed by 86
 * links in a row, every one of them pointing into the old site's uploads
 * folder. Here each issue is a document this site owns, and the years are real
 * tabs again.
 *
 * Nothing about the page needs editing when an issue is published — uploading
 * a PDF with `category: newsletter` and a month is enough, and it appears
 * under the right year.
 */

/**
 * Issues still only on the previous website.
 *
 * `npm run newsletter:import` took over this year and last year, which is what
 * the archdiocese asked for. The rest are listed as a link rather than
 * silently dropped, because 71 issues of a newsletter are not a thing to lose
 * quietly. Importing them is `NEWSLETTER_YEARS=2024,2023,... npm run
 * newsletter:import`; when that is done, delete this and the block that uses
 * it — and it must be done before the old site is switched off, since the link
 * dies with it.
 */
const EARLIER = {
  // A dash rather than "2019 to 2024": this is dropped into a Tamil sentence
  // as well as an English one, and an English word inside it reads as a fault.
  years: '2019–2024',
  url: 'https://archdioceseofmadrasmylapore.in/news-letter-2/',
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/newsletter'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.media.newsletterTitle,
    description: t.media.newsletterIntro,
    alternates: alternatesFor('/newsletter', locale),
  }
}

export default async function NewsletterRoute({
  params,
}: PageProps<'/[locale]/newsletter'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const result = await payload.find({
    overrideAccess: false,
    collection: 'documents',
    where: { category: { equals: 'newsletter' } },
    sort: '-issueDate',
    limit: 500,
    depth: 0,
    locale,
  })

  /**
   * Group by year. The date is read in UTC because that is how it is written —
   * see the `issueDate` field in src/collections/Documents.ts. Reading it in
   * the visitor's timezone would file a January issue under the previous year
   * for anyone west of Greenwich.
   */
  const years = new Map<number, DocumentCard[]>()

  for (const doc of result.docs) {
    if (!doc.url || !doc.issueDate) continue

    const year = new Date(doc.issueDate).getUTCFullYear()
    const cards = years.get(year) ?? []

    cards.push({
      id: String(doc.id),
      title: doc.title,
      description: doc.description ?? null,
      url: doc.url,
      filename: doc.filename ?? '',
      mimeType: doc.mimeType ?? null,
      filesize: doc.filesize ?? null,
      language: doc.language ?? null,
    })

    years.set(year, cards)
  }

  const tabs: Tab[] = [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, cards]) => ({
      id: String(year),
      label: String(year),
      content: (
        <DocumentList
          documents={cards}
          labels={{
            // No heading: the tab already says which year this is.
            download: t.page.download,
            fileMeta: t.page.fileMeta,
            tamil: t.page.inTamil,
            english: t.page.inEnglish,
          }}
        />
      ),
    }))

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
          {t.media.newsletterTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t.media.newsletterIntro}</p>
      </header>

      {tabs.length > 0 ? (
        <Tabs tabs={tabs} label={t.media.newsletterYears} />
      ) : (
        <p className="text-slate-600">{t.media.newsletterEmpty}</p>
      )}

      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="font-semibold text-slate-900">{t.media.earlierHeading}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {fill(t.media.earlierBody, { years: EARLIER.years })}
        </p>
        <a
          href={EARLIER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          {t.media.earlierCta}
        </a>
      </section>
    </div>
  )
}
