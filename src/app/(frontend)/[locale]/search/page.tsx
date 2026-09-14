import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SearchForm } from '@/components/SearchForm'
import {
  isSearchGroup,
  runSearch,
  sanitizeQuery,
  type SearchGroup,
} from '@/lib/search'
import {
  alternatesFor,
  fill,
  getDictionary,
  isLocale,
  localePath,
} from '@/lib/i18n'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.search.title,
    description: t.search.intro,
    alternates: alternatesFor('/search', locale),
    // A search results page is not something to index: it has no content of
    // its own, and Google treats indexed result pages as thin content.
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<'/[locale]/search'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const { q: rawQuery, group: rawGroup } = await searchParams

  const query = sanitizeQuery(typeof rawQuery === 'string' ? rawQuery : '')
  const groupParam = typeof rawGroup === 'string' ? rawGroup : undefined
  const only: SearchGroup | undefined = isSearchGroup(groupParam) ? groupParam : undefined

  const { results, total } = query
    ? await runSearch(query, locale, only)
    : { results: [], total: 0 }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t.search.title}</h1>
        <p className="mt-3 text-slate-600">{t.search.intro}</p>
      </header>

      <div className="mt-6">
        <SearchForm
          locale={locale}
          defaultValue={query}
          placeholder={t.search.placeholder}
          label={t.search.title}
          submit={t.search.submit}
          autoFocus
        />
        <p className="mt-2 text-xs text-slate-500">{t.search.contentNote}</p>
      </div>

      {!query ? (
        <p className="mt-10 text-slate-500">{t.search.empty}</p>
      ) : total === 0 ? (
        <div className="mt-10">
          <p className="font-medium">{fill(t.search.none, { q: query })}</p>
          <p className="mt-2 text-sm text-slate-500">{t.search.noneHint}</p>
        </div>
      ) : (
        <div className="mt-10">
          <p className="text-sm text-slate-500">
            {fill(t.search.resultsFor, { q: query })} ·{' '}
            {fill(t.search.count, { count: total })}
            {only && (
              <>
                {' · '}
                <Link
                  href={`${localePath('/search', locale)}?q=${encodeURIComponent(query)}`}
                  className="underline hover:text-slate-800"
                >
                  {t.search.groups[only]}
                </Link>
              </>
            )}
          </p>

          <div className="mt-6 space-y-10">
            {results.map((result) => (
              <section key={result.group}>
                <h2 className="text-sm font-medium tracking-wide text-slate-500 uppercase">
                  {t.search.groups[result.group]}
                </h2>

                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {result.hits.map((hit) => (
                    <li key={hit.id} className="py-3">
                      <Link
                        href={localePath(hit.path, locale)}
                        className="font-medium hover:underline"
                      >
                        {hit.title}
                      </Link>
                      {hit.meta && (
                        <p className="mt-0.5 text-sm text-slate-600">{hit.meta}</p>
                      )}
                    </li>
                  ))}
                </ul>

                {!only && result.total > result.hits.length && (
                  <Link
                    href={`${localePath('/search', locale)}?q=${encodeURIComponent(
                      query,
                    )}&group=${result.group}`}
                    className="mt-3 inline-block text-sm text-slate-700 underline hover:text-slate-900"
                  >
                    {fill(t.search.more, {
                      count: result.total,
                      group: t.search.groups[result.group],
                    })}
                  </Link>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
