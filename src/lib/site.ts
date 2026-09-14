/**
 * The site's own absolute base URL.
 *
 * Needed by anything that has to emit a fully-qualified URL rather than a
 * path: the sitemap, robots.txt and the JSON-LD structured data. Page
 * metadata keeps using relative paths, which Next.js resolves itself.
 *
 * `NEXT_PUBLIC_SERVER_URL` is the same variable Payload uses, so there is one
 * place to change at cutover. It is http://localhost:3000 in development,
 * which is correct for development and wrong everywhere else — hence the
 * warning below rather than a silent fallback to a guessed domain.
 */
const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim()

/**
 * Render sets this for the running service. It is a safety net for the demo,
 * not a replacement for setting the variable: `NEXT_PUBLIC_SERVER_URL` is
 * read while the pages are being built, and this one only exists once the
 * container is running — so without it the structured data baked into the
 * prerendered pages would still say localhost.
 */
const platform = process.env.RENDER_EXTERNAL_URL?.trim()

if (!configured && !platform && process.env.NODE_ENV === 'production') {
  console.warn(
    'NEXT_PUBLIC_SERVER_URL is not set. The sitemap, robots.txt and structured data will point at localhost.',
  )
}

/** No trailing slash, so `${SITE_URL}${path}` is always well formed. */
export const SITE_URL = (configured || platform || 'http://localhost:3000').replace(
  /\/+$/,
  '',
)

export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/**
 * The archdiocesan office, exactly as the old site's Contact Us page published
 * it — the only place these details appeared. Nothing is added: no postcode,
 * no office hours and no department contacts were ever published, so none
 * appear here or in the structured data.
 *
 * Defined here rather than in the contact page because the structured data
 * needs the same values, and two copies of an address drift apart.
 */
export const OFFICE = {
  name: "Archbishop's House",
  lines: ['41, Santhome High Road', 'Santhome, Chennai'],
  phones: [
    { label: '044 2464 1102', href: 'tel:+914424641102' },
    { label: '044 2464 0833', href: 'tel:+914424640833' },
  ],
  email: 'abpmmsec@gmail.com',
  /** For a maps link and for the structured data's single-line address. */
  fullAddress: "Archbishop's House, 41 Santhome High Road, Santhome, Chennai",
} as const
