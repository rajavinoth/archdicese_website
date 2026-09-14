import { getPayload } from 'payload'
import config from '@payload-config'

import type { Locale } from '@/lib/i18n'

export const SEARCH_GROUPS = ['parishes', 'clergy', 'pages', 'news', 'events'] as const
export type SearchGroup = (typeof SEARCH_GROUPS)[number]

export const isSearchGroup = (value: string | undefined): value is SearchGroup =>
  Boolean(value) && (SEARCH_GROUPS as readonly string[]).includes(value as string)

export type SearchHit = {
  id: string
  title: string
  /** Locale-neutral path; the caller adds the language prefix. */
  path: string
  /** Secondary line: an assignment, a date, a place. */
  meta: string | null
}

export type SearchResult = {
  group: SearchGroup
  total: number
  hits: SearchHit[]
}

/**
 * Clean a user's query before it reaches the database.
 *
 * This is not optional. Payload's `like` operator interpolates the value
 * directly into a SQL LIKE pattern — the adapter does literally
 *
 *   val.split(' ').map((word) => ilike(column, `%${word}%`))
 *
 * so `%` and `_` typed by a visitor are wildcards, not characters. A search for
 * "%" would match every row in the collection. That is the same trap that once
 * matched (and deleted) every parish in this database from a `contains: '%'`
 * filter, so the wildcards are stripped rather than escaped: Payload gives no
 * way to add a LIKE ESCAPE clause.
 *
 * The length cap keeps a pathological query from turning into a hundred ANDed
 * LIKE scans.
 */
export const sanitizeQuery = (raw: string | undefined | null): string => {
  if (!raw) return ''
  return raw
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Per-group cap on the mixed-results view. A single group shows more. */
const PREVIEW_LIMIT = 5
const GROUP_LIMIT = 50

const dateMeta = (iso: string | null | undefined, locale: Locale): string | null => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/**
 * Search titles, names, assignments and places across the site.
 *
 * Rich-text bodies are not searched. Payload stores them as Lexical JSON, and
 * matching text inside that JSON with SQL LIKE would hit field names and node
 * types as often as words a visitor typed. Doing it properly needs a real
 * index (a search plugin or Postgres full-text), which is a production task,
 * so the limitation is stated on the page rather than faked.
 *
 * Note on multi-word queries: `like` ANDs the words *within a single field*,
 * so "Antony Adyar" finds a parish whose name contains both, not a parish
 * called Antony in the area of Adyar. Each field is ORed with the others.
 */
export const runSearch = async (
  query: string,
  locale: Locale,
  only?: SearchGroup,
): Promise<{ results: SearchResult[]; total: number }> => {
  const q = sanitizeQuery(query)
  if (!q) return { results: [], total: 0 }

  const payload = await getPayload({ config })
  const limit = only ? GROUP_LIMIT : PREVIEW_LIMIT

  /** Every collection here is read as the public would read it. */
  const common = { overrideAccess: false, depth: 0, locale, limit } as const

  const wanted = (group: SearchGroup) => !only || only === group

  const [parishes, clergy, pages, posts, events] = await Promise.all([
    wanted('parishes')
      ? payload.find({
          ...common,
          collection: 'parishes',
          where: {
            or: [
              { name: { like: q } },
              { patron: { like: q } },
              { 'address.city': { like: q } },
            ],
          },
          sort: 'name',
        })
      : null,
    wanted('clergy')
      ? payload.find({
          ...common,
          collection: 'clergy',
          where: {
            or: [{ name: { like: q } }, { currentAssignment: { like: q } }],
          },
          sort: 'name',
        })
      : null,
    wanted('pages')
      ? payload.find({
          ...common,
          collection: 'pages',
          where: { title: { like: q } },
          sort: 'title',
        })
      : null,
    wanted('news')
      ? payload.find({
          ...common,
          collection: 'posts',
          where: {
            or: [{ title: { like: q } }, { excerpt: { like: q } }],
          },
          sort: '-publishedAt',
        })
      : null,
    wanted('events')
      ? payload.find({
          ...common,
          collection: 'events',
          where: {
            or: [{ title: { like: q } }, { location: { like: q } }],
          },
          sort: '-startDate',
        })
      : null,
  ])

  const results: SearchResult[] = []

  if (parishes) {
    results.push({
      group: 'parishes',
      total: parishes.totalDocs,
      hits: parishes.docs.map((doc) => ({
        id: String(doc.id),
        title: doc.name,
        path: `/parishes/${doc.slug}`,
        meta: [doc.patron, doc.address?.city].filter(Boolean).join(', ') || null,
      })),
    })
  }

  if (clergy) {
    results.push({
      group: 'clergy',
      total: clergy.totalDocs,
      hits: clergy.docs.map((doc) => ({
        id: String(doc.id),
        title: doc.name,
        path: `/clergy/${doc.slug}`,
        meta: doc.currentAssignment ?? null,
      })),
    })
  }

  if (pages) {
    results.push({
      group: 'pages',
      total: pages.totalDocs,
      hits: pages.docs.map((doc) => ({
        id: String(doc.id),
        title: doc.title,
        path: `/${doc.slug}`,
        meta: null,
      })),
    })
  }

  if (posts) {
    results.push({
      group: 'news',
      total: posts.totalDocs,
      hits: posts.docs.map((doc) => ({
        id: String(doc.id),
        title: doc.title,
        path: `/news/${doc.slug}`,
        meta: dateMeta(doc.publishedAt, locale),
      })),
    })
  }

  if (events) {
    results.push({
      group: 'events',
      total: events.totalDocs,
      hits: events.docs.map((doc) => ({
        id: String(doc.id),
        title: doc.title,
        path: `/events/${doc.slug}`,
        meta: [dateMeta(doc.startDate, locale), doc.location].filter(Boolean).join(' · ') || null,
      })),
    })
  }

  return {
    results: results.filter((result) => result.total > 0),
    total: results.reduce((sum, result) => sum + result.total, 0),
  }
}
