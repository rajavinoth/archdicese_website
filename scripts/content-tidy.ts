/**
 * Cleans up two things the WordPress migration left behind in page content.
 *
 * Justified text
 * --------------
 * The old WordPress theme justified nearly every paragraph — 45 of them across
 * the migrated pages. Justification without hyphenation, which is what a
 * browser does, opens rivers of white space between words; on
 * /history-of-archdiocese it left lines like "by an agreement between the Holy
 * Father and the King of Portugal" stretched across the measure. It reads
 * worse and it is markedly worse for dyslexic readers, which is why justified
 * body text is not a default anywhere on the web any more.
 *
 * Why this fixes the data rather than overriding it in CSS
 * --------------------------------------------------------
 * The alignment is an inline `style="text-align:justify"` on each paragraph.
 * Inline styles beat stylesheets, so a CSS fix would need `!important` — which
 * would then also override an editor who deliberately justified something
 * later. Changing the stored value leaves the admin's alignment control
 * working normally.
 *
 * `center` and `left` are left alone. Eight paragraphs are centred and that
 * looks deliberate — a title line, a closing attribution — so only `justify`
 * is cleared.
 *
 * Un-decoded HTML entities
 * ------------------------
 * Six text nodes still contained a literal `&amp;` — "Prayer &amp; Preaching
 * Ministry". Because it is stored as text rather than markup, React escapes it
 * again on the way out, so the page displayed the entity itself instead of an
 * ampersand. Only the five standard XML entities and numeric escapes are
 * decoded; nothing else is touched.
 *
 * Run with:  npm run content:tidy
 *            CONTENT_DRY=1 npm run content:tidy
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import { LOCALES } from '../src/lib/i18n'

const DRY = process.env.CONTENT_DRY === '1'

type LexicalNode = {
  format?: unknown
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

/**
 * Decode the entities a browser would have decoded, had this been markup.
 * Deliberately narrow: the five XML entities plus numeric escapes. `&amp;` is
 * decoded last, so a double-escaped "&amp;lt;" does not collapse into a "<".
 */
const decodeEntities = (input: string): string =>
  input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')

type Counts = { justified: number; entities: number }

/** Walk the tree, clearing justification and decoding entities in text nodes. */
const tidy = (node: LexicalNode, counts: Counts): void => {
  if (node.format === 'justify') {
    node.format = ''
    counts.justified++
  }

  if (typeof node.text === 'string') {
    const decoded = decodeEntities(node.text)
    if (decoded !== node.text) {
      node.text = decoded
      counts.entities++
    }
  }

  for (const child of node.children ?? []) tidy(child, counts)
}

const main = async () => {
  const payload = await getPayload({ config })

  let pagesChanged = 0
  const totals: Counts = { justified: 0, entities: 0 }

  for (const locale of LOCALES) {
    /**
     * `fallbackLocale: false` is essential, not a detail.
     *
     * The site runs with `fallback: true`, so asking for a Tamil page that has
     * no Tamil translation returns the *English* content. Writing that back
     * under the `ta` locale would create a real Tamil record containing English
     * text — freezing today's English into the Tamil column and silently
     * killing the fallback for every one of those pages. The first dry run did
     * exactly this: identical counts for `en` and `ta` on all four pages.
     *
     * With the fallback off, an untranslated page comes back with no content
     * and is skipped, which is correct: there is nothing there to un-justify.
     */
    const pages = await payload.find({
      collection: 'pages',
      limit: 1000,
      depth: 0,
      pagination: false,
      locale,
      fallbackLocale: false,
    })

    for (const page of pages.docs) {
      if (!page.content) continue

      /**
       * Deep clone before touching it: the object handed back by the Local API
       * may be shared with Payload's own caches, and mutating it in place
       * could change what a later query sees without anything being saved.
       */
      const content = structuredClone(page.content) as { root?: LexicalNode }
      if (!content.root) continue

      const counts: Counts = { justified: 0, entities: 0 }
      tidy(content.root, counts)
      if (counts.justified === 0 && counts.entities === 0) continue

      totals.justified += counts.justified
      totals.entities += counts.entities
      pagesChanged++
      console.log(
        `  ${locale}/${page.slug}: ${counts.justified} un-justified, ${counts.entities} entities decoded`,
      )

      if (DRY) continue

      await payload.update({
        collection: 'pages',
        id: page.id,
        locale,
        data: { content } as never,
        context: { disableRevalidate: true },
      })
    }
  }

  console.log(
    `\n  ${totals.justified} paragraphs un-justified, ${totals.entities} text nodes decoded,` +
      ` across ${pagesChanged} page/locale records`,
  )
  console.log(`  Centred and left-aligned paragraphs were left as they are.`)

  if (DRY) console.log('\nDry run. Re-run without CONTENT_DRY=1 to apply.')
  process.exit(0)
}

await main()
