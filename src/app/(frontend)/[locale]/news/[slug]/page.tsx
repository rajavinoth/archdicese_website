import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@payload-config'
import { JsonLd } from '@/components/JsonLd'
import { DEFAULT_LOCALE, LOCALES, getDictionary, isLocale, localePath, type Locale, alternatesFor } from '@/lib/i18n'
import { articleSchema, breadcrumbSchema, graph } from '@/lib/structured-data'

const getPost = async (slug: string, locale: Locale) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    overrideAccess: false,
    collection: 'posts',
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
    collection: 'posts',
    limit: 1000,
    pagination: false,
  })
  return LOCALES.flatMap((locale) =>
    result.docs.map((post) => ({ locale, slug: post.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/news/[slug]'>): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const post = await getPost(slug, locale)
  if (!post) return { title: 'Not found' }
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: alternatesFor(`/news/${slug}`, locale),
  }
}

export default async function NewsArticlePage({ params }: PageProps<'/[locale]/news/[slug]'>) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const post = await getPost(slug, locale)

  if (!post) notFound()

  const date = post.publishedAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(post.publishedAt))
    : null

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <JsonLd
        data={graph(
          articleSchema(post, locale),
          breadcrumbSchema(
            [
              { name: t.siteName, path: '/' },
              { name: t.news.title, path: '/news' },
              { name: post.title, path: `/news/${slug}` },
            ],
            locale,
          ),
        )}
      />

      <p className="text-sm text-slate-500">
        <Link href={localePath('/news', locale)} className="hover:underline">
          {t.news.title}
        </Link>
      </p>

      <header className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        {date && <p className="mt-2 text-sm text-slate-500">{date}</p>}
      </header>

      {post.content ? (
        <div className="prose prose-slate mt-8 max-w-none text-slate-700">
          <RichText data={post.content} />
        </div>
      ) : (
        <p className="mt-8 text-slate-500">{t.news.noContent}</p>
      )}
    </article>
  )
}
