/**
 * Checks whether the "Elementor stub" pages actually have recoverable content
 * on the live site.
 *
 * `content.rendered` comes back empty for 14 pages, and the assumption was
 * that Elementor was holding their layout in `_elementor_data` post meta. That
 * needed testing rather than assuming, because if the content IS rendered on
 * the public page it can be scraped instead of retyped.
 *
 * Method: take the region between `</header>` and `<footer`, which excludes the
 * site chrome. (The header and footer are themselves Elementor templates, so
 * counting `elementor-section` occurrences is misleading -- the first ones on
 * the page belong to the header, and the long prose that looks like page copy
 * is a footer widget.)
 *
 * Run with:  npm run wp:probe-stubs
 * Output:    .migration/_stub-probe.json
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('.migration')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
}

const PACE_MS = 600
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const get = async (url, attempt = 1) => {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (!text.trim()) throw new Error('empty body')
    return text
  } catch (error) {
    if (attempt >= 3) throw new Error(`${url}: ${error.message}`)
    await sleep(2000 * attempt)
    return get(url, attempt + 1)
  }
}

/** The page's own content, with site chrome removed. */
export const contentRegion = (html) => {
  const headerEnd = html.indexOf('</header>')
  const footerStart = html.indexOf('<footer')

  const start = headerEnd >= 0 ? headerEnd + '</header>'.length : 0
  const end = footerStart > start ? footerStart : html.length

  return html
    .slice(start, end)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const main = async () => {
  const plan = JSON.parse(await fs.readFile(path.join(OUT, '_plan.json'), 'utf8'))
  const stubs = plan.rows.filter((row) => row.category === 'page:stub')

  console.log(`Probing ${stubs.length} stub pages\n`)

  const results = []

  for (const stub of stubs) {
    try {
      const html = await get(stub.url)
      const region = contentRegion(html)
      const text = textOf(region)

      // The page title is always echoed in the region; ignore it when judging.
      const withoutTitle = text
        .replace(new RegExp(stub.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
        .trim()

      const result = {
        slug: stub.cleanSlug,
        url: stub.url,
        regionBytes: region.length,
        textChars: withoutTitle.length,
        images: (region.match(/<img\b/gi) ?? []).length,
        links: (region.match(/<a\b[^>]*href="https?:/gi) ?? []).length,
        iframes: (region.match(/<iframe\b/gi) ?? []).length,
        tables: (region.match(/<table\b/gi) ?? []).length,
        pdfs: (region.match(/href="[^"]*\.pdf/gi) ?? []).length,
        sample: withoutTitle.slice(0, 160),
        html: region,
      }
      results.push(result)

      const verdict =
        result.textChars > 40 || result.images || result.links || result.iframes || result.tables
          ? 'HAS CONTENT'
          : 'empty'

      console.log(
        `  ${stub.cleanSlug.padEnd(34)} text=${String(result.textChars).padStart(5)}` +
          ` img=${result.images} link=${result.links} iframe=${result.iframes}` +
          ` table=${result.tables} pdf=${result.pdfs}  ${verdict}`,
      )
    } catch (error) {
      console.log(`  ${stub.cleanSlug.padEnd(34)} FAILED: ${error.message}`)
      results.push({ slug: stub.cleanSlug, url: stub.url, error: error.message })
    }

    await sleep(PACE_MS)
  }

  await fs.writeFile(
    path.join(OUT, '_stub-probe.json'),
    JSON.stringify(results, null, 2),
    'utf8',
  )

  const withContent = results.filter(
    (r) => r.textChars > 40 || r.images || r.links || r.iframes || r.tables,
  )
  console.log(`\n  ${withContent.length}/${results.length} have recoverable content`)
  console.log(`\nWrote ${path.join(OUT, '_stub-probe.json')}`)
}

await main()
