/**
 * Writes a Tamil translation into a page's `ta` locale.
 *
 * How the mapping works, and why it cannot drift
 * ----------------------------------------------
 * The translation file is an ordered array of strings, one per **text node**
 * in the English document. This script clones the English Lexical tree,
 * replaces each text node's text with its counterpart, and saves the result as
 * the Tamil version. Every heading, paragraph, line break and inline format is
 * preserved exactly, because the structure is the English structure.
 *
 * The whole thing hangs on the array being the same length as the document has
 * text nodes, so that is asserted before anything is written. If somebody edits
 * the English page, the count stops matching and the script refuses rather than
 * shifting every paragraph one position along — which would produce a page that
 * looked plausible and said the wrong things.
 *
 * `fallbackLocale: false` is used throughout. Without it, reading the Tamil
 * version of an untranslated page returns the English text, and a
 * re-run would happily "translate" English into English.
 *
 * The translation is machine-made and flagged as such
 * ---------------------------------------------------
 * The page is saved with `translationNeedsReview: true` on the Tamil locale,
 * which puts a notice at the top of the Tamil page asking readers to treat it
 * as provisional. This is a diocesan history full of proper nouns, papal names
 * and canonical vocabulary; a Tamil-speaking member of the archdiocese needs to
 * read it before the notice comes off. Unticking that one checkbox in the admin
 * is what removes it.
 *
 * Run with:  npm run translation:apply
 *            TRANSLATION_DRY=1 npm run translation:apply
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.TRANSLATION_DRY === '1'

/** Which pages have a translation file, and where it is. */
const TRANSLATIONS: { slug: string; file: string }[] = [
  {
    slug: 'history-of-archdiocese',
    file: 'scripts/data/history-of-archdiocese-ta.json',
  },
]

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

type TranslationFile = {
  _source: Record<string, unknown>
  title: string
  nodes: string[]
}

/** Every text node, in document order. */
const textNodesOf = (root: LexicalNode): LexicalNode[] => {
  const found: LexicalNode[] = []

  const visit = (node: LexicalNode) => {
    if (node.type === 'text') found.push(node)
    for (const child of node.children ?? []) visit(child)
  }

  visit(root)
  return found
}

const main = async () => {
  const payload = await getPayload({ config })

  let applied = 0

  for (const { slug, file } of TRANSLATIONS) {
    const raw = await fs.readFile(path.resolve(file), 'utf8')
    const translation = JSON.parse(raw) as TranslationFile

    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      locale: 'en',
      fallbackLocale: false,
    })

    const page = result.docs[0]
    if (!page) {
      console.log(`  ${slug}: no such page`)
      continue
    }

    if (!page.content) {
      console.log(`  ${slug}: the English page has no content to translate`)
      continue
    }

    const content = structuredClone(page.content) as { root?: LexicalNode }
    if (!content.root) continue

    const nodes = textNodesOf(content.root)

    if (nodes.length !== translation.nodes.length) {
      console.log(
        `\n  REFUSED — ${slug}\n` +
          `    the English page has ${nodes.length} text nodes,\n` +
          `    the translation file has ${translation.nodes.length}.\n\n` +
          `    The English content has changed since the translation was written.\n` +
          `    Applying it anyway would shift every paragraph out of position, so\n` +
          `    nothing was written. Re-check ${file} against the English page.`,
      )
      continue
    }

    // Report any node whose translation was left empty, rather than silently
    // blanking a paragraph.
    const blanks = translation.nodes
      .map((text, index) => (text.trim() === '' ? index : -1))
      .filter((index) => index !== -1)

    if (blanks.length) {
      console.log(
        `  ${slug}: ${blanks.length} untranslated nodes (${blanks.join(', ')}) — the English text is kept for those`,
      )
    }

    nodes.forEach((node, index) => {
      const translated = translation.nodes[index]
      if (translated.trim() !== '') node.text = translated
    })

    const translatedChars = translation.nodes.reduce((sum, text) => sum + text.length, 0)
    console.log(
      `  ${slug}: ${nodes.length} text nodes, ${translatedChars.toLocaleString('en-IN')} characters of Tamil`,
    )

    if (DRY) continue

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'ta',
      data: {
        title: translation.title,
        content,
        translationNeedsReview: true,
      } as never,
      context: { disableRevalidate: true },
    })

    applied++
  }

  console.log(`\n  ${applied} page(s) translated`)
  console.log(
    `  Each is flagged "translation needs review" — the Tamil page shows a notice\n` +
      `  until a Tamil speaker unticks it in the admin.`,
  )

  if (DRY) console.log('\nDry run. Re-run without TRANSLATION_DRY=1 to apply.')
  process.exit(0)
}

await main()
