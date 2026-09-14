/**
 * Pulls the headings out of a Lexical document so a page can offer a table of
 * contents and deep links to its sections.
 *
 * /history-of-archdiocese is thirteen sections and several thousand words. On
 * the old site it was one unbroken scroll with no way to reach "Synods"
 * without hunting for it.
 *
 * Why ids are assigned here rather than derived in the renderer
 * ------------------------------------------------------------
 * The table of contents and the headings themselves have to agree on every id,
 * or the links go nowhere. Deriving the id from the heading's text in two
 * places works only while no two headings share text — true on these pages
 * today, and a silent breakage the day somebody adds a second "Overview".
 *
 * So the ids are assigned once, in document order, and handed to the renderer
 * in a Map keyed by the heading node itself. The renderer receives the very
 * same node objects, so the lookup cannot drift.
 */

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

export type TocItem = {
  id: string
  text: string
  /** 2, 3 or 4 — the heading's own level, used to indent the list. */
  level: number
}

export type Toc = {
  items: TocItem[]
  /** heading node -> the id stamped on it. */
  ids: Map<LexicalNode, string>
}

const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/**
 * Combining marks left behind by NFKD normalisation, and the Tamil block.
 *
 * Written as \u escapes rather than literal characters: a combining mark typed
 * into a character class is invisible in an editor, impossible to review in a
 * diff, and this project has already lost time to unprintable bytes smuggled
 * into a regex.
 */
const COMBINING_MARKS = /[\u0300-\u036f]/g
const NOT_SLUG_SAFE = /[^a-z0-9\u0B80-\u0BFF]+/g

/**
 * A readable anchor. Trailing punctuation goes because several of these
 * headings end in a stray colon ("Pastoral Activities:", "Some Key Events :"),
 * which would otherwise end up in the URL. Tamil characters are kept, so a
 * Tamil heading gets a real anchor instead of a row of hyphens.
 */
const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(NOT_SLUG_SAFE, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section'

/**
 * Walk the document in order, collecting headings and assigning each a unique
 * id. Only h2-h4 count: h1 belongs to the page title, and anything deeper is
 * too fine-grained to navigate by.
 */
export const buildToc = (content: unknown, skip?: Set<LexicalNode>): Toc => {
  const ids = new Map<LexicalNode, string>()
  const items: TocItem[] = []
  const used = new Set<string>()

  const root = (content as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return { items, ids }

  const visit = (node: LexicalNode) => {
    // Headings that are really label/value field rows are not sections, and
    // ninety of them would bury the four real ones. See rich-text-shapes.ts.
    if (node.type === 'heading' && !skip?.has(node)) {
      const level = Number(String(node.tag ?? 'h3').replace('h', ''))

      if (level >= 2 && level <= 4) {
        const text = textOf(node).trim()

        if (text) {
          let id = slugify(text)
          // Two headings with the same words still get distinct anchors.
          let suffix = 2
          while (used.has(id)) id = `${slugify(text)}-${suffix++}`
          used.add(id)

          ids.set(node, id)
          items.push({ id, text: text.replace(/\s*:\s*$/, ''), level })
        }
      }
    }

    for (const child of node.children ?? []) visit(child)
  }

  visit(root)

  return { items, ids }
}

/**
 * Worth showing a contents list? A page with two headings does not need one,
 * and an empty box is worse than none.
 */
export const TOC_MIN_HEADINGS = 4
