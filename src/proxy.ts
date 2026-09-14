import { NextResponse, type NextRequest } from 'next/server'

import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n'

/**
 * Locale routing.
 *
 * This is Next 16's `proxy` file convention -- the former `middleware.ts`,
 * which now warns as deprecated.
 *
 * Every page lives under `app/(frontend)/[locale]/`, but English must stay at
 * the root: all ~270 redirects carried over from the old WordPress site point
 * at root paths (`/clergy`, `/about`), and prefixing English would break them.
 *
 * So:
 *   /clergy      -> rewritten internally to /en/clergy   (URL stays /clergy)
 *   /ta/clergy   -> passes through to /ta/clergy
 *   /en/clergy   -> redirected to /clergy, so each page has one canonical URL
 *
 * A rewrite is invisible to the browser; a redirect changes the address bar.
 * That difference is the whole trick here.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split('/')
  const first = segments[1] ?? ''

  // /en/... is not canonical -- send it to the unprefixed path.
  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/'
    return NextResponse.redirect(url, 308)
  }

  // A real locale prefix (currently only /ta) already matches [locale].
  if ((LOCALES as readonly string[]).includes(first)) {
    return NextResponse.next()
  }

  // Everything else is English at the root: rewrite it under /en.
  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  /**
   * Skip anything that is not a page:
   *   admin, api        -- Payload owns these
   *   _next, media      -- build output and uploads
   *   anything with a . -- favicon.ico, robots.txt, images
   *
   * Each name is followed by `(?:/|$)` so it only matches a whole first
   * segment. Without that boundary the rule excluded any path merely
   * *beginning* with one of the words, and `/administration` — a real page —
   * never reached the locale rewrite and served a prerendered 404. The same
   * would have hit any future page whose slug started with "api" or "media".
   *
   * Nothing is listed here that is not actually served: the uploaded documents
   * live under /api/documents/file/, which `api` already covers, so listing
   * "documents" as well would only block a future page with that slug — the
   * very bug this comment is about.
   */
  matcher: ['/((?!admin(?:/|$)|api(?:/|$)|_next(?:/|$)|media(?:/|$)|.*\\.).*)'],
}
