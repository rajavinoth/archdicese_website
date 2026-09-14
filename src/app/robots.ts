import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * robots.txt
 *
 * The disallows are not about secrecy — the admin panel and the API enforce
 * their own access control. They are about not wasting crawl budget on pages
 * that either cannot be crawled usefully or should not be in an index:
 *
 *   /admin   the Payload admin panel (a login screen to a crawler)
 *   /api     the REST and GraphQL endpoints
 *   /search  results pages; thin content, and infinite in number
 *
 * `DEMO_NOINDEX` shuts the whole thing to crawlers, and the demo deployment
 * sets it. A public copy of a real archdiocese's website is a second site with
 * the same content: it competes with the archdiocese's own pages in search
 * results, and somebody who found it there would have no way of knowing it was
 * not the real one. The site is still readable by anyone with the link, which
 * is what a demo is for; it simply is not advertised.
 *
 * This is only half of it — robots.txt asks a crawler not to fetch a page, but
 * a page linked from elsewhere can still be listed. The other half is the
 * `noindex` header in the layout's metadata, which does prevent listing.
 */
/**
 * Generated at build time, not per request. It already was — both files only
 * read the database and the environment, and Next.js listed them as static —
 * but a static export requires that to be stated rather than inferred.
 */
export const dynamic = 'force-static'

const NOINDEX = process.env.DEMO_NOINDEX === '1'

export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/search', '/ta/search'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
