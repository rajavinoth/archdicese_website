import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { DocumentList, type DocumentCard } from '@/components/DocumentList'
import { PageBody } from '@/components/PageBody'
import config from '@payload-config'
import { DEFAULT_LOCALE, LOCALES, fill,
  getDictionary, isLocale, type Locale, alternatesFor } from '@/lib/i18n'

/**
 * Catch-all for CMS pages, so the resource pages migrated from WordPress keep
 * their original URLs (/the-bible, /fcra-report, ...).
 *
 * Static routes such as /clergy, /parishes, /news and /admin take precedence
 * over this in Next.js routing, so it only handles what they do not.
 */
const getPage = async (slug: string, locale: Locale) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'pages',
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
    collection: 'pages',
    limit: 1000,
    pagination: false,
  })
  return LOCALES.flatMap((locale) =>
    result.docs.map((page) => ({ locale, slug: page.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/[slug]'>): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const page = await getPage(slug, locale)
  if (!page) return { title: 'Not found' }
  return {
    title: page.title,
    description: page.excerpt ?? undefined,
    alternates: alternatesFor(`/${slug}`, locale),
  }
}

export default async function CmsPage({ params }: PageProps<'/[locale]/[slug]'>) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const page = await getPage(slug, locale)

  if (!page) notFound()

  /**
   * Downloads attached to this page. `depth: 1` on the query resolves them to
   * full records; anything still a bare id is skipped rather than rendered as
   * an empty card.
   */
  const documents: DocumentCard[] = (page.documents ?? [])
    .filter((entry): entry is Exclude<typeof entry, number | string> =>
      typeof entry === 'object' && entry !== null,
    )
    .flatMap((doc) =>
      doc.url
        ? [
            {
              id: String(doc.id),
              title: doc.title,
              description: doc.description ?? null,
              url: doc.url,
              filename: doc.filename ?? '',
              mimeType: doc.mimeType ?? null,
              filesize: doc.filesize ?? null,
              language: doc.language ?? null,
            },
          ]
        : [],
    )

  return (
    <article className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
        {page.title}
      </h1>

      {/*
        A machine translation says so at the top, before anything is read --
        this is a diocesan history full of proper nouns and canonical
        vocabulary, and a reader deserves to know what they are looking at.
        Unticking the checkbox in the admin removes it.
      */}
      {page.translationNeedsReview && (
        <div className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {t.page.translationReviewTitle}
          </p>
          <p className="mt-1 text-sm text-amber-900">{t.page.translationReviewBody}</p>
        </div>
      )}

      {page.externalUrl ? (
        /**
         * Several pages on the old site were nothing but a link to a resource
         * hosted elsewhere -- the Bible, Catechism and Canon Law on vatican.va,
         * reflections on cbci.in. The URL is kept so the page still works and
         * stays indexed, but the visitor is told plainly that they are leaving.
         */
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-semibold text-slate-900">{t.page.externalHeading}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {fill(t.page.externalBody, { host: new URL(page.externalUrl).hostname })}
          </p>
          <a
            href={page.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t.page.externalCta}
          </a>
          <p className="mt-3 text-xs break-all text-slate-400">{page.externalUrl}</p>
        </div>
      ) : page.content || documents.length > 0 ? (
        <>
          {page.content && (
            <PageBody content={page.content} tocLabel={t.page.contents} />
          )}
          <DocumentList
            documents={documents}
            labels={{
              heading: t.page.documentsHeading,
              download: t.page.download,
              fileMeta: t.page.fileMeta,
              tamil: t.page.inTamil,
              english: t.page.inEnglish,
            }}
          />
        </>
      ) : (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">{t.page.notRebuilt}</p>
          <p className="mt-2">
            {t.page.notRebuiltBody}
          </p>
          {page.legacy?.url && (
            <p className="mt-2">
              {t.page.originalAt}{' '}
              <a
                href={page.legacy.url}
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                the old site
              </a>
              .
            </p>
          )}
        </div>
      )}
    </article>
  )
}
