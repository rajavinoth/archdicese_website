/**
 * Cleaning WordPress HTML before it is converted to Lexical.
 *
 * `<a>` with a non-URL href (`#`, `javascript:`, empty) becomes a link node
 * that fails Payload's "Enter a URL" validation, so those anchors are
 * unwrapped to plain text. `<iframe>` embeds (mostly YouTube on the galleries)
 * become ordinary links so the destination survives.
 *
 * Images are deliberately LEFT IN PLACE here. Payload's HTML converter turns
 * `<img>` into a Lexical upload node, and it reads two attributes to decide
 * what that node points at:
 *
 *     data-lexical-upload-relation-to="media"
 *     data-lexical-upload-id="<payload media id>"
 *
 * With both present it produces a valid upload node. Without them it produces
 * a *pending* upload node, which is what made every page with an image fail
 * with "upload node failed to validate". The importer downloads each image
 * into the media library and stamps those attributes on, via `markImage`.
 */

const VALID_HREF = /^(https?:\/\/|mailto:|tel:|\/)/i

const SITE = 'https://archdioceseofmadrasmylapore.in'

/**
 * @param {string} input raw `content.rendered` from WordPress
 * @returns {{ html: string, embeds: string[], unwrappedLinks: number }}
 */
export const sanitizeWpHtml = (input) => {
  let html = String(input ?? '')

  const embeds = []
  let unwrappedLinks = 0

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // iframe/embed -> a plain link, so the URL survives the migration.
  html = html.replace(
    /<(iframe|embed)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>(?:[\s\S]*?<\/\1>)?/gi,
    (_match, _tag, src) => {
      embeds.push(src)
      return `<p><a href="${src}">${src}</a></p>`
    },
  )
  html = html.replace(/<object\b[\s\S]*?<\/object>/gi, (match) => {
    const data = /\bdata=["']([^"']+)["']/i.exec(match)
    if (!data) return ''
    embeds.push(data[1])
    return `<p><a href="${data[1]}">${data[1]}</a></p>`
  })

  // Unwrap anchors whose href Payload would reject.
  html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    const href = /\bhref=["']([^"']*)["']/i.exec(attrs)
    if (href && VALID_HREF.test(href[1].trim())) return match
    unwrappedLinks++
    return inner
  })

  // Elementor leaves a lot of empty scaffolding behind.
  html = html
    .replace(/<(div|span|section|figure)\b[^>]*>\s*<\/\1>/gi, '')
    .replace(/(&nbsp;|\s)+/g, ' ')
    .trim()

  return { html, embeds, unwrappedLinks }
}

/** Absolute URL for a possibly protocol-relative or root-relative src. */
export const absoluteUrl = (src) => {
  const value = String(src ?? '').trim()
  if (!value) return null
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/')) return `${SITE}${value}`
  if (/^https?:\/\//i.test(value)) return value
  return null // data: URIs and anything else we cannot fetch
}

/**
 * WordPress rewrites `photo.jpg` to `photo-300x200.jpg` for each registered
 * size. Strip that suffix so a resized `src` still matches the original
 * attachment's `source_url` in the media cache.
 */
export const originalUrl = (url) =>
  String(url ?? '').replace(/-\d{2,4}x\d{2,4}(\.[a-z]{3,4})$/i, '$1')

/** Every `<img>` in the markup, with what we can learn about each. */
export const extractImages = (html) => {
  const tags = String(html ?? '').match(/<img\b[^>]*>/gi) ?? []

  return tags.map((tag) => {
    const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1] ?? null
    const alt = /\balt=["']([^"']*)["']/i.exec(tag)?.[1] ?? ''
    // WordPress adds `class="... wp-image-1234"`, which gives us the
    // attachment id directly and avoids URL guesswork.
    const wpId = /\bwp-image-(\d+)\b/i.exec(tag)?.[1]

    return {
      tag,
      src,
      alt,
      wpId: wpId ? Number(wpId) : null,
    }
  })
}

/**
 * Rebuild an `<img>` so Payload's converter turns it into a real upload node.
 */
export const markImage = ({ src, alt }, mediaId) =>
  `<img src="${src}" alt="${(alt || '').replace(/"/g, '&quot;')}"` +
  ` data-lexical-upload-relation-to="media" data-lexical-upload-id="${mediaId}" />`

/**
 * Rewrites two-column "label | VIEW-link" tables into a proper list.
 *
 * The resource pages (`others`, `cbci-links`) are tables whose first cell is
 * the organisation's name as plain text and whose second cell is a link
 * labelled "VIEW". Payload's Lexical converter drops table structure, so that
 * came out as alternating lines -- "Amruthavani Communications", then "VIEW" --
 * with the name no longer attached to its link.
 *
 * Nothing is invented here: the label and the URL both come from the row, they
 * are simply joined so the name itself becomes the link.
 *
 * A table is only rewritten if EVERY row matches the pattern; anything else is
 * left exactly as it was.
 */
export const linkifyTwoColumnTables = (input) => {
  let converted = 0

  const html = String(input ?? '').replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    if (rows.length === 0) return table

    const items = []

    for (const [, rowHtml] of rows) {
      const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (m) => m[1],
      )
      if (cells.length !== 2) return table

      const label = cells[0].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const anchors = [...cells[1].matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)]

      // Needs a plain label on the left and exactly one link on the right.
      // `<a[\s>]` rather than `<a` so it does not trip on `<abbr>`.
      if (!label || anchors.length !== 1 || /<a[\s>]/i.test(cells[0])) return table

      items.push(`<li><a href="${anchors[0][1]}">${label}</a></li>`)
    }

    converted += items.length
    return `<ul>${items.join('')}</ul>`
  })

  return { html, converted }
}
