import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import { localePath } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'

/**
 * sitemap.xml, covering both languages.
 *
 * A sitemap is one document for the whole site, so each page is listed once
 * with its Tamil equivalent as an `alternates` entry. That is what Google asks
 * for — one URL per piece of content with hreflang alternates — rather than
 * two sitemaps that look like duplicate content.
 *
 * Placement: directly in src/app, NOT in the (frontend) route group, and
 * alongside robots.ts. A sitemap.ts inside the group does work, but robots.ts
 * inside the group does not — `/robots.txt` gets swallowed by the [locale]
 * dynamic segment and 404s, with no error to explain it. Keeping both at the
 * app root avoids the trap. Neither file needs a layout: they are route
 * handlers, not pages.
 *
 * Queries pass `overrideAccess: false` so unpublished drafts never reach the
 * sitemap. Submitting a URL that 404s is worse than not submitting it — and
 * ten unpublished posts would otherwise be in here.
 */

type Row = { slug: string; updatedAt?: string | null }

/** One sitemap entry per path, with the en/ta pair declared as alternates. */
const entry = (
  path: string,
  lastModified: string | null | undefined,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap[number] => ({
  url: `${SITE_URL}${localePath(path, 'en')}`,
  lastModified: lastModified ? new Date(lastModified) : undefined,
  changeFrequency,
  priority,
  alternates: {
    languages: {
      'en-IN': `${SITE_URL}${localePath(path, 'en')}`,
      'ta-IN': `${SITE_URL}${localePath(path, 'ta')}`,
    },
  },
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })

  const query = { overrideAccess: false, limit: 2000, depth: 0, pagination: false } as const

  const [parishes, clergy, pages, posts, events] = await Promise.all([
    payload.find({ ...query, collection: 'parishes' }),
    payload.find({ ...query, collection: 'clergy' }),
    payload.find({ ...query, collection: 'pages' }),
    payload.find({ ...query, collection: 'posts' }),
    payload.find({ ...query, collection: 'events' }),
  ])

  const listOf = (docs: Row[], prefix: string, priority: number) =>
    docs.map((doc) =>
      entry(`${prefix}/${doc.slug}`, doc.updatedAt, 'monthly', priority),
    )

  return [
    // The index pages, which is what people land on and what changes most.
    entry('/', new Date().toISOString(), 'weekly', 1),
    entry('/parishes', new Date().toISOString(), 'weekly', 0.9),
    entry('/clergy', new Date().toISOString(), 'weekly', 0.8),
    entry('/events', new Date().toISOString(), 'weekly', 0.6),
    entry('/news', new Date().toISOString(), 'weekly', 0.6),
    entry('/contact', null, 'yearly', 0.7),
    /**
     * A real route rather than a CMS page, so it is not in the `pages` query
     * below. Listing it by hand: unpublishing the superseded prose page
     * silently dropped /archbishop out of the sitemap altogether.
     */
    entry('/archbishop', new Date().toISOString(), 'monthly', 0.8),
    entry('/newsletter', new Date().toISOString(), 'monthly', 0.6),
    entry('/photo-gallery', new Date().toISOString(), 'monthly', 0.5),
    entry('/video-gallery', new Date().toISOString(), 'monthly', 0.5),

    // A parish page is the thing people actually search for, so it ranks
    // above everything else on the site.
    ...listOf(parishes.docs as Row[], '/parishes', 0.8),
    ...listOf(clergy.docs as Row[], '/clergy', 0.5),
    ...listOf(posts.docs as Row[], '/news', 0.5),

    // Past calendar entries are real content and worth indexing, but they are
    // the least useful thing a visitor could land on.
    ...listOf(events.docs as Row[], '/events', 0.3),

    // Pages sit at the root (/about, /forms), matching the old site's URLs.
    ...pages.docs.map((page) => entry(`/${page.slug}`, page.updatedAt, 'monthly', 0.6)),

    // /search is deliberately absent: it is marked noindex, having no content
    // of its own.
  ]
}
