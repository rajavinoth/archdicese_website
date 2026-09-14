/**
 * Restores the section structure of /archbishop, which the migration lost.
 *
 * What the page was
 * -----------------
 * On the old site it was a WonderPlugin tab set. Flattening it to HTML threw
 * away the tabs and left one 283-block page containing four unrelated things
 * end to end, with the tab labels stranded as a bullet list at the top:
 *
 *     Archbishop's Profile
 *     Archbishop's Calander
 *     Former Prelates Of Madras
 *     Former Prelates Of Mylapore
 *     Former prelates of the archdiocese of madras - mylapore
 *
 * This turns those stranded labels back into real headings at the points where
 * their content actually begins, so the page is navigable and the contents
 * list has something to list.
 *
 * How the boundaries were established
 * -----------------------------------
 * Not guessed — read off the content, and checked against the live old site's
 * tab panels:
 *
 *   * The first succession list runs 1606 to 1951 and ends with Dom Manuel de
 *     Medeiros Guerreiro. That is **Mylapore**: the diocese was erected in
 *     1606 and Guerreiro was its last padroado bishop, as the history page
 *     also says.
 *   * The second runs 1832 to 1952, from Dom John bede Polding to Louis
 *     Mathias. That is **Madras**: its vicariate was created in 1832.
 *   * The list after them begins with Louis Mathias as "First Archbishop
 *     1952", so it is the **Archdiocese of Madras–Mylapore**.
 *
 * The two lists cannot be confused: one is Portuguese padroado bishops ending
 * in 1951, the other starts in 1832 with an entirely different set of names.
 *
 * What is removed
 * ---------------
 *   * **The calendar.** A dead Timely widget: "Agenda / Day / Month / Week",
 *     "There are no upcoming events to display at this time", and a row of
 *     "Add to Google / Outlook / Apple Calendar" links that go nowhere. The
 *     archdiocese's real calendar is at /events.
 *   * **"WordPress Tabs"** — the tab plugin's own credit line, twice.
 *   * **The stranded tab-label list**, replaced by the headings it named.
 *
 * Run with:  npm run archbishop:restructure
 *            ARCHBISHOP_DRY=1 npm run archbishop:restructure
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.ARCHBISHOP_DRY === '1'

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

const textOf = (node: LexicalNode): string => {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

const heading = (text: string): LexicalNode => ({
  type: 'heading',
  tag: 'h3',
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  children: [
    { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 },
  ],
})

/** Dead calendar widget: every line it leaves behind. */
const CALENDAR_JUNK = [
  'agenda',
  'day',
  'month',
  'week',
  'subscribe',
  'there are no upcoming events to display at this time.',
]

const isCalendarJunk = (node: LexicalNode): boolean => {
  const text = textOf(node).trim().toLowerCase()
  if (!text) return false
  if (CALENDAR_JUNK.includes(text)) return true
  // "September 2026 Sep 2026" — the widget's month header, twice over.
  if (/^[a-z]+ \d{4}\s+[a-z]{3} \d{4}$/.test(text)) return true
  // "Add to Timely Calendar / Add to Google / ..." — the subscribe list.
  if (text.startsWith('add to timely calendar')) return true
  return false
}

const isPluginCredit = (node: LexicalNode): boolean =>
  textOf(node).trim().toLowerCase() === 'wordpress tabs'

/** The stranded tab bar, recognised by the labels it contains. */
const isTabBar = (node: LexicalNode): boolean => {
  if (node.type !== 'list') return false
  const text = textOf(node).toLowerCase()
  return text.includes("archbishop's profile") && text.includes('former prelates')
}

const TERM = /^\s*\d{4}\s*(?:[-–—]\s*(?:\d{4}|present)\s*)?$/i

const main = async () => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'archbishop' } },
    limit: 1,
    depth: 0,
    locale: 'en',
    fallbackLocale: false,
  })

  const page = result.docs[0]
  if (!page?.content) {
    console.log('  /archbishop: nothing to restructure')
    process.exit(0)
  }

  const content = structuredClone(page.content) as { root?: LexicalNode }
  const blocks = content.root?.children ?? []

  if (blocks.some((block) => block.type === 'heading' && textOf(block).trim() === 'Archbishop’s Profile')) {
    console.log('  /archbishop: already restructured, nothing to do')
    process.exit(0)
  }

  /**
   * Where each succession list begins: a name paragraph whose term is the
   * year given, found by scanning rather than by hard-coded index, so an edit
   * to the page above does not shift the boundaries.
   */
  const startOfList = (firstTerm: string): number =>
    blocks.findIndex((block, index) => {
      const next = blocks[index + 1]
      if (!next || block.type !== 'paragraph' || next.type !== 'paragraph') return false
      return TERM.test(textOf(next).trim()) && textOf(next).trim() === firstTerm
    })

  const mylaporeStart = startOfList('1606 - 1615')
  const madrasStart = startOfList('1832')
  const combinedStart = blocks.findIndex(
    (block) => block.type === 'list' && textOf(block).includes('LOUIS MATHIAS'),
  )

  const missing = [
    mylaporeStart === -1 ? 'Mylapore list (1606 - 1615)' : null,
    madrasStart === -1 ? 'Madras list (1832)' : null,
    combinedStart === -1 ? 'Madras-Mylapore list (Louis Mathias)' : null,
  ].filter(Boolean)

  if (missing.length) {
    console.log(
      `  REFUSED — could not find: ${missing.join(', ')}.\n` +
        `  The page content has changed; re-check the boundaries before running this.`,
    )
    process.exit(1)
  }

  console.log(
    `  boundaries: Mylapore at block ${mylaporeStart}, Madras at ${madrasStart}, Madras-Mylapore at ${combinedStart}`,
  )

  const out: LexicalNode[] = []
  let removedCalendar = 0
  let removedCredits = 0
  let removedTabBars = 0
  let inserted = 0

  blocks.forEach((block, index) => {
    if (isTabBar(block)) {
      removedTabBars++
      // The first real section starts immediately after it.
      out.push(heading('Archbishop’s Profile'))
      inserted++
      return
    }
    if (isCalendarJunk(block)) {
      removedCalendar++
      return
    }
    if (isPluginCredit(block)) {
      removedCredits++
      return
    }

    if (index === mylaporeStart) {
      out.push(heading('Former Prelates of Mylapore'))
      inserted++
    }
    if (index === madrasStart) {
      out.push(heading('Former Prelates of Madras'))
      inserted++
    }
    if (index === combinedStart) {
      out.push(heading('Former Prelates of the Archdiocese of Madras–Mylapore'))
      inserted++
    }

    out.push(block)
  })

  console.log(`  removed: ${removedCalendar} dead calendar lines, ${removedCredits} plugin credits, ${removedTabBars} tab bar`)
  console.log(`  inserted: ${inserted} section headings`)
  console.log(`  blocks: ${blocks.length} -> ${out.length}`)

  if (DRY) {
    console.log('\nDry run. Re-run without ARCHBISHOP_DRY=1 to apply.')
    process.exit(0)
  }

  await payload.update({
    collection: 'pages',
    id: page.id,
    locale: 'en',
    data: { content: { ...content, root: { ...content.root!, children: out } } } as never,
    context: { disableRevalidate: true },
  })

  console.log('\n  /archbishop restructured.')
  process.exit(0)
}

await main()
