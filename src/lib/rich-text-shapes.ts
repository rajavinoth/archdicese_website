/**
 * Recognises two shapes that the WordPress migration flattened into prose, so
 * they can be rendered as what they actually are.
 *
 * The Archbishop page is the worst case. On the old site it was a set of
 * plugin tabs containing styled field widgets; flattened to HTML and converted
 * to Lexical, it became 283 blocks of which **90 are `h4` headings** whose text
 * is a label and a value jammed together. Rendered as prose it reads:
 *
 *     PHONE
 *     044-24 64 11 02, 24 64 08 33
 *     FAX
 *     044 - 24 64 19 99
 *
 * — ninety pseudo-headings in a row, no alignment, and a table of contents
 * with ninety entries in it. The underlying structure is perfectly regular
 * though, so it can be recovered rather than re-typed:
 *
 *   1. **Field rows.** A heading whose children are
 *      `[text][linebreak][text]…` — the first text is the label, the rest are
 *      the value. Becomes a definition list.
 *
 *   2. **Succession rows.** A paragraph holding a person's name, immediately
 *      followed by a paragraph holding nothing but a year or year range
 *      ("1606 - 1615"). That is a list of prelates and their terms — 34 of
 *      them, from 1606. Becomes a two-column list.
 *
 * Both are keyed by the node object itself, so the renderer's lookup cannot
 * disagree with the analysis — the same trick the heading ids use.
 */

export type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  format?: unknown
  children?: LexicalNode[]
  [key: string]: unknown
}

export type FieldRow = { label: string; values: string[] }
export type SuccessionRow = { name: string; term: string }

export type Shapes = {
  /** Heading node -> the label/value pair it really is. */
  fields: Map<LexicalNode, FieldRow>
  /** Name paragraph -> the term that follows it. */
  succession: Map<LexicalNode, SuccessionRow>
  /** Nodes already accounted for by a row above, so the renderer skips them. */
  consumed: Set<LexicalNode>
  /** Headings that are really body paragraphs. See PROSE_HEADING_LENGTH. */
  prose: Set<LexicalNode>
  /**
   * Paragraphs that continue the value of the field row above them, to be
   * rendered in the value column rather than full width.
   */
  continuations: Set<LexicalNode>
}

/**
 * A "heading" longer than this is a paragraph that was marked up as a heading.
 *
 * The old site did this throughout: the Archbishop page's whole HISTORY
 * section is nine `h4` elements each holding a full paragraph, one of them 411
 * characters long. Left as headings they gave the page nine fake sections and
 * filled the contents list with half-sentences.
 *
 * 70 characters sits well clear of the real headings on these pages — the
 * longest is "Former Prelates of the Archdiocese of Madras–Mylapore" at 53 —
 * and well below the shortest offender at 82.
 */
const PROSE_HEADING_LENGTH = 70

/** "1606 - 1615", "1832", "2006 – 2011". Nothing else. */
const TERM = /^\s*\d{4}\s*(?:[-–—]\s*(?:\d{4}|present)\s*)?$/i

const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/**
 * Split a heading's children on line breaks. Returns null unless it really is
 * a label followed by at least one value — a plain heading must stay a
 * heading.
 */
const asFieldRow = (node: LexicalNode): FieldRow | null => {
  if (node.type !== 'heading') return null

  const children = node.children ?? []
  if (!children.some((child) => child.type === 'linebreak')) return null

  const lines: string[] = []
  let current = ''

  for (const child of children) {
    if (child.type === 'linebreak') {
      lines.push(current.trim())
      current = ''
      continue
    }
    current += textOf(child)
  }
  lines.push(current.trim())

  const parts = lines.filter((line) => line !== '')
  if (parts.length < 2) return null

  const [label, ...values] = parts

  // A "label" the length of a sentence is a paragraph that happens to wrap,
  // not a field name.
  if (label.length > 40) return null

  return { label, values }
}

/** A paragraph holding nothing but horizontal rules and whitespace. */
const isRuleOnly = (node: LexicalNode): boolean => {
  if (node.type !== 'paragraph') return false
  const children = node.children ?? []
  if (!children.some((child) => child.type === 'horizontalrule')) return false
  return children.every(
    (child) =>
      child.type === 'horizontalrule' ||
      (typeof child.text === 'string' && child.text.trim() === ''),
  )
}

/**
 * Analyse a document once. The renderer then looks each node up rather than
 * re-deriving anything.
 */
export const findShapes = (content: unknown): Shapes => {
  const fields = new Map<LexicalNode, FieldRow>()
  const succession = new Map<LexicalNode, SuccessionRow>()
  const consumed = new Set<LexicalNode>()
  const prose = new Set<LexicalNode>()
  const continuations = new Set<LexicalNode>()

  const root = (content as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return { fields, succession, consumed, prose, continuations }

  const blocks = root.children ?? []

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]

    const field = asFieldRow(block)
    if (field) {
      fields.set(block, field)
      continue
    }

    if (block.type === 'heading' && textOf(block).trim().length > PROSE_HEADING_LENGTH) {
      prose.add(block)
      continue
    }

    // A name paragraph followed by a bare term.
    if (block.type === 'paragraph') {
      const next = blocks[index + 1]
      const name = textOf(block).trim()
      const term = next?.type === 'paragraph' ? textOf(next).trim() : ''

      if (name && !TERM.test(name) && term && TERM.test(term)) {
        succession.set(block, { name, term })
        consumed.add(next)
        index++
      }
    }
  }

  /**
   * Second pass, now that every field row is known.
   *
   * The old page put a horizontal rule between each field and let long values
   * spill into a following paragraph — the Archbishop's address is "ADDRESS /
   * Archbishop's House," in the heading and "41, San Thome High Road…" in the
   * next paragraph. Rendered literally that is a divider, a gap, and an
   * orphaned line of address at full width.
   *
   * So within a run of field rows: rules are dropped, because each row already
   * draws its own; and a following plain paragraph is marked as a continuation
   * so it can be aligned under the value column. Neither changes the stored
   * content — a value is never merged into another field, only positioned.
   */
  let lastWasField = false

  for (const block of blocks) {
    if (fields.has(block)) {
      lastWasField = true
      continue
    }

    if (!lastWasField) continue

    if (isRuleOnly(block)) {
      consumed.add(block)
      continue
    }

    if (block.type === 'paragraph' && textOf(block).trim() !== '') {
      continuations.add(block)
      continue
    }

    if (block.type === 'paragraph') continue // blank spacer, harmless

    lastWasField = false
  }

  return { fields, succession, consumed, prose, continuations }
}
