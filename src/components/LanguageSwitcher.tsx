'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { DEFAULT_LOCALE, LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n'

/**
 * Switches language while staying on the same page.
 *
 * `usePathname()` returns the URL the visitor sees, which for English is the
 * unprefixed path (the /en rewrite happens in middleware and is invisible
 * here). So the current locale prefix is stripped first, then the target one
 * applied.
 */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale
  label: string
}) {
  const pathname = usePathname() || '/'

  // Strip any locale prefix to get the shared, language-neutral path.
  const segments = pathname.split('/')
  const withoutLocale =
    segments.length > 1 && (LOCALES as readonly string[]).includes(segments[1])
      ? '/' + segments.slice(2).join('/')
      : pathname

  const basePath = withoutLocale === '' ? '/' : withoutLocale

  const hrefFor = (locale: Locale) => {
    if (locale === DEFAULT_LOCALE) return basePath
    return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>

      {LOCALES.map((locale, index) => (
        <span key={locale} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="text-brand-400">
              |
            </span>
          )}

          {/*
            Colours are for the navy header this sits in -- the original
            slate-900/slate-600 pair was all but invisible once the header
            stopped being white.
          */}
          {locale === current ? (
            <span aria-current="true" className="font-semibold text-gold-200">
              {LOCALE_LABEL[locale]}
            </span>
          ) : (
            <Link
              href={hrefFor(locale)}
              hrefLang={locale}
              className="text-brand-100 underline-offset-4 hover:text-white hover:underline"
            >
              {LOCALE_LABEL[locale]}
            </Link>
          )}
        </span>
      ))}
    </div>
  )
}
