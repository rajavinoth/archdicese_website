/**
 * Shared classification rules for the WordPress migration.
 *
 * The old site put everything in `pages` and `posts` regardless of what it
 * actually was: priest profiles, parish descriptions, resource pages, one-off
 * 2020 campaign pages, WooCommerce plumbing and a fair amount of junk. This
 * module is the single place that decides what each record becomes.
 *
 * Used by both `wp:report` (dry run) and `wp:import` (the real thing), so the
 * report always describes exactly what the import will do.
 */

/** Pages created by plugins that have no place on the new site. */
const INFRASTRUCTURE_SLUGS = new Set([
  'sample-page',
  'shop',
  'cart',
  'checkout',
  'my-account',
  'donation-confirmation',
  'donation-failed',
  'donor-dashboard',
  'blog-page',
  'blog-page-2',
  'blog-page-3',
  'buddy',
  'church_new',
  'church_new-2',
  'home-church-3',
])

/** Listing pages that the new site generates from data instead. */
const REPLACED_BY_GENERATED_SLUGS = new Set([
  'parishes',
  'parish',
  'shrine',
  'priest',
  'events',
  'churches',
  'our-church',
  // The old calendar was an All-in-One Event Calendar widget, which the live
  // page shows as "There are no upcoming events to display". /events replaces it.
  'calendar',
])

/**
 * Near-duplicate pages on the old site, resolved by hand after comparing them.
 *
 * These could not be deduped by a rule. In each pair the *base* slug is an
 * empty navigation shortcut (its "content" was a link placed in the page
 * title) and the "-N" copy holds the real content -- so a naive "drop the -2"
 * rule would have deleted the good copy and kept a blank page.
 *
 * `DUPLICATE_OF` maps a redundant slug to the URL that should serve instead.
 * `CONTENT_SOURCE` maps a canonical slug to the record its content comes from.
 *
 * The evidence, for anyone revisiting this:
 *
 *  - others-2 (wpId 7738) and others-3 (wpId 7740) have IDENTICAL text and 24
 *    links each, differing in exactly one URL: -2 links to
 *    thecatholicuniverse.com, -3 to universecatholicweekly.co.uk. That is the
 *    same publication after a rebrand, so -3 is the later correction and wins.
 *    (Both of those URLs are unreachable today; see the page's review note.)
 *  - cbci-links (wpId 7651) is empty; cbci-links-2 (wpId 7734) carries 42KB.
 *  - fr-a-amal-raj (wpId 7901) and fr-a-amal-raj-2 (wpId 7918) are identical
 *    once tags are stripped: the same priest entered twice.
 */
export const DUPLICATE_OF = {
  'others-2': 'others',
  'others-3': 'others',
  'cbci-links-2': 'cbci-links',
  'fr-a-amal-raj-2': 'fr-a-amal-raj',
}

/** Canonical slug -> the WordPress slug whose content it should use. */
export const CONTENT_SOURCE = {
  others: 'others-3',
  'cbci-links': 'cbci-links-2',
}

const CLERGY_SLUG = /^(fr|rev|msgr|most-rev)-/
const NUMERIC_JUNK = /^\d+(-\d+)?$/

/**
 * Test pages, scratch drafts and Elementor library templates. These have real
 * content in them (one Elementor template is 14k characters) so no
 * content-based heuristic catches them -- they have to be named.
 */
const TEST_AND_TEMPLATE = [
  /^elementor-/, // Elementor saved templates
  /^template\d*$/,
  /^test-page/,
  /^tesbdask/, // "tesbdasknb" -- someone testing the editor
  /^website-under-maintainance$/,
  /^song-2$/,
]

/** The old homepage. The new site has its own, so this redirects to "/". */
const OLD_HOMEPAGE = 'home'

/**
 * Some slugs carry URL-encoded junk, e.g. "video-gallery%ef%bf%bc" (a stray
 * byte-order mark). Decode, strip anything that is not URL-safe, and tidy up.
 */
export const cleanSlug = (slug) => {
  let out = String(slug ?? '')
  try {
    out = decodeURIComponent(out)
  } catch {
    // Leave it as-is if it is not valid percent-encoding.
  }
  return (
    out
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}

/**
 * Detecting parishes by "does the title contain the word church" was too
 * loose: it swallowed `catechism-of-the-catholic-church` (a resource page) and
 * a news post titled "The Gospel According to Satan Released". A parish is
 * recognised either by a saint-style name plus a building word, or by a title
 * that *ends* in the building word.
 */
const BUILDING_WORD = /(church|cathedral|basilica|chapel|shrine)/i
const BUILDING_WORD_TRAILING = /(church|cathedral|basilica|chapel|shrine)[\s.,'’]*$/i
const SAINT_PREFIX =
  /^(st\.?|saint|san|our lady|sacred heart|holy|infant jesus|christ the|annai|velankanni|lourdes)\b/i

/** Titles that merely happen to contain a building word. */
const NOT_A_PARISH = /(catechism|canon law|the bible|vatican|cbci|gospel according|urges|synod|reflection|newsletter|circular)/i

/** Titles that are really listing pages the new site generates. */
const LISTING_TITLES = new Set([
  'shrine',
  'shrines',
  'church',
  'churches',
  'parish',
  'parishes',
  'priest',
  'priests',
  'our church',
  'clergy',
])

const looksLikeParish = (title) => {
  if (!title || NOT_A_PARISH.test(title)) return false
  if (LISTING_TITLES.has(title.trim().toLowerCase())) return false
  if (!BUILDING_WORD.test(title)) return false

  // Strip any Tamil transliteration that follows the English name.
  const english = title.replace(/[^\x00-\x7F]+/g, ' ').trim()
  return SAINT_PREFIX.test(english) || BUILDING_WORD_TRAILING.test(english)
}

export const CATEGORY = {
  CLERGY: 'clergy',
  PARISH: 'parish',
  PAGE: 'page',
  PAGE_STUB: 'page:stub',
  POST: 'post',
  SKIP_INFRA: 'skip:infrastructure',
  SKIP_JUNK: 'skip:junk',
  SKIP_GENERATED: 'skip:replaced-by-generated-page',
  SKIP_DUPLICATE: 'skip:duplicate',
}

const textOf = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Whether a page carries anything worth importing.
 *
 * Plain text length alone is the wrong test, and got this wrong first time
 * round: `transfer-list-2` is a PDF file block and `ordination-list` is a Ninja
 * Tables shortcode. Both have real content but almost no stripped text, and
 * both were being discarded as empty.
 */
const contentSignal = (html) => {
  const raw = String(html ?? '')
  return {
    text: textOf(raw).length,
    embeds: (raw.match(/<(iframe|object|embed|video|audio|table|img)\b/gi) ?? []).length,
    links: (raw.match(/<a\b[^>]+href=/gi) ?? []).length,
    shortcodes: (raw.match(/\[[a-z][a-z0-9_-]*[\s\]]/gi) ?? []).length,
  }
}

/**
 * Decide what a single WordPress record becomes.
 * Returns { category, reason }.
 */
export const classify = (record, type) => {
  const slug = record.slug ?? ''
  const title = textOf(record.title?.rendered)

  if (INFRASTRUCTURE_SLUGS.has(slug)) {
    return { category: CATEGORY.SKIP_INFRA, reason: 'plugin/e-commerce page' }
  }

  if (REPLACED_BY_GENERATED_SLUGS.has(slug)) {
    return {
      category: CATEGORY.SKIP_GENERATED,
      reason: 'the new site generates this listing from records',
    }
  }

  // "7775-2", "755-2", "9374-2" -- orphaned drafts published with no title.
  if (NUMERIC_JUNK.test(slug) || NUMERIC_JUNK.test(title)) {
    return { category: CATEGORY.SKIP_JUNK, reason: 'numeric placeholder title/slug' }
  }

  if (TEST_AND_TEMPLATE.some((pattern) => pattern.test(slug))) {
    return { category: CATEGORY.SKIP_JUNK, reason: 'test page or Elementor template' }
  }

  if (Object.hasOwn(DUPLICATE_OF, slug)) {
    return {
      category: CATEGORY.SKIP_DUPLICATE,
      reason: `duplicate of "${DUPLICATE_OF[slug]}"; that URL serves the content`,
    }
  }

  if (slug === OLD_HOMEPAGE) {
    return {
      category: CATEGORY.SKIP_GENERATED,
      reason: 'old homepage; the new site has its own',
    }
  }

  if (record.contentUnavailable) {
    return {
      category: CATEGORY.SKIP_JUNK,
      reason: 'content too large for their API (Elementor layout template)',
    }
  }

  if (CLERGY_SLUG.test(slug)) {
    return { category: CATEGORY.CLERGY, reason: 'priest profile' }
  }

  // Titles that are really listings the new site generates from records.
  if (LISTING_TITLES.has(title.trim().toLowerCase())) {
    return {
      category: CATEGORY.SKIP_GENERATED,
      reason: 'the new site generates this listing from records',
    }
  }

  if (type === 'posts') {
    // A few "posts" are really parish descriptions.
    if (looksLikeParish(title)) {
      return { category: CATEGORY.PARISH, reason: 'parish described as a blog post' }
    }
    return { category: CATEGORY.POST, reason: 'news article' }
  }

  if (looksLikeParish(title)) {
    return { category: CATEGORY.PARISH, reason: 'parish page' }
  }

  // `others` and `cbci-links` look empty on their own record but are given the
  // content of their duplicate, so they are content pages rather than stubs.
  if (Object.hasOwn(CONTENT_SOURCE, slug)) {
    return { category: CATEGORY.PAGE, reason: 'content page (merged from its duplicate)' }
  }

  const signal = contentSignal(record.content?.rendered)

  if (signal.text >= 40 || signal.embeds > 0 || signal.links > 0 || signal.shortcodes > 0) {
    return { category: CATEGORY.PAGE, reason: 'content page' }
  }

  /**
   * No content in the REST API. These are Elementor-built pages -- Elementor
   * keeps its layout in the `_elementor_data` post meta, which WordPress does
   * not expose, so `content.rendered` comes back empty even though the live
   * page shows something.
   *
   * They are imported as flagged stubs rather than dropped, for two reasons:
   * the URLs are already indexed by Google and need a redirect target, and a
   * visible item in the admin marked "needs review" is far safer than content
   * that silently disappeared.
   */
  return {
    category: CATEGORY.PAGE_STUB,
    reason: 'no content via REST (Elementor page) — imported as stub for review',
  }
}

export const plainText = textOf
