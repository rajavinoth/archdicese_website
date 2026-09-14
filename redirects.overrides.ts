/**
 * Hand-maintained redirects that take precedence over the generated map.
 *
 * `redirects.generated.json` is produced mechanically by `npm run wp:report`
 * from the old site's URLs, so it maps every old post URL to wherever that post
 * now lives. When a post is deliberately *not* republished, that mapping points
 * at a page which 404s — a 301 into a dead end, which is worse for both
 * visitors and search engines than sending them somewhere useful.
 *
 * These overrides are applied before the generated map (Next.js uses the first
 * matching rule), so editing them never gets clobbered by re-running the
 * report.
 */

type Redirect = { source: string; destination: string; permanent: boolean }

/**
 * The ten news posts unpublished by `npm run posts:quarantine` — six were
 * WordPress theme demo content belonging to other publishers, four were empty.
 * Their old URLs go to the news index rather than to a missing article.
 */
const QUARANTINED_POSTS = [
  'church-urges-government-to-address-poverty',
  'objectively-create-quality-bandwidth',
  'join-us-as-we-celebrate-baptism',
  'the-dog-likeness-of-christ',
  '7-ways-to-protect-and-pass-on-the-gospel',
  'is-there-forgiveness-for-a-seminary-student',
  'welcome-to-archdiocese-of-mylapore',
  'deanery-of-our-lady-of-lourdes',
  'deanery-of-the-sacred-heart-of-jesus',
  'deanery-of-st-john-the-baptist',
]

export const redirectOverrides: Redirect[] = [
  /**
   * The newsletter moved off the migrated page and onto a real archive at
   * /newsletter — see scripts/newsletter-import.ts. 301: the old address is
   * never coming back, and the archdiocese's newsletter has been linked to
   * from elsewhere for years.
   */
  { source: '/news-letter-2', destination: '/newsletter', permanent: true },

  ...QUARANTINED_POSTS.map((slug) => ({
    source: `/${slug}`,
    destination: '/news',
    // 302: the archdiocese may yet write real content at these addresses, and
    // a 301 would be cached by browsers for a long time.
    permanent: false,
  })),
]
