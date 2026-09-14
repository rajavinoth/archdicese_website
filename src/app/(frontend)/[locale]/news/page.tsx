import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { LOCALES, getDictionary, isLocale, localePath, alternatesFor } from '@/lib/i18n'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/news'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return {
    title: t.news.title,
    description: t.news.intro,
    alternates: alternatesFor('/news', locale),
  }
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

export default async function NewsPage({ params }: PageProps<'/[locale]/news'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const result = await payload.find({
    overrideAccess: false,
    collection: 'posts',
    limit: 100,
    sort: '-publishedAt',
    depth: 0,
    locale,
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t.news.title}</h1>
        <p className="mt-3 text-slate-600">{t.news.intro}</p>
      </header>

      {result.docs.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {t.news.none}
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-100 border-t border-slate-100">
          {result.docs.map((post) => {
            const date = formatDate(post.publishedAt, locale)

            return (
              <li key={post.id} className="py-5">
                {date && <p className="text-xs text-slate-500">{date}</p>}
                <h2 className="mt-1 font-medium">
                  <Link href={`${localePath('/news', locale)}/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                {/* Skip an excerpt that just repeats the title -- see the
                    same guard on the homepage. */}
                {post.excerpt && post.excerpt.trim() !== post.title.trim() && (
                  <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
