import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { NavMenu } from '@/components/NavMenu'
import { notFound } from 'next/navigation'
import { Geist } from 'next/font/google'
import './globals.css'

import {
  DEFAULT_LOCALE,
  HTML_LANG,
  LOCALES,
  getDictionary,
  isLocale,
  localePath,
} from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SearchForm } from '@/components/SearchForm'
import { OFFICE } from '@/lib/site'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

/** Both language versions are prerendered. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const t = getDictionary(locale)

  return {
    title: { default: t.siteName, template: `%s — ${t.siteName}` },
    description: t.home.intro,
    /**
     * The demo deployment sets DEMO_NOINDEX, which keeps a public copy of a
     * real archdiocese's website out of search results. robots.txt alone does
     * not do that — it stops a crawler fetching the page, but a page linked
     * from somewhere else can still be listed without ever being fetched.
     * This header is what actually prevents listing.
     */
    ...(process.env.DEMO_NOINDEX === '1'
      ? { robots: { index: false, follow: false } }
      : {}),
    // No `alternates` here on purpose: a layout cannot know the current path,
    // so a canonical set here would claim every page is the homepage. Each
    // page sets its own via `alternatesFor()`.
  }
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)

  const nav = [
    { href: '/', label: t.nav.home },
    { href: '/parishes', label: t.nav.parishes },
    { href: '/clergy', label: t.nav.clergy },
    { href: '/events', label: t.nav.events },
    { href: '/news', label: t.nav.news },
  ]

  /**
   * The newsletter and the two galleries. Grouped rather than added to the row
   * above because nine links across the header wrap onto a second row on a
   * laptop; in the footer, where there is room, they are listed plainly.
   */
  const mediaNav = [
    { href: '/photo-gallery', label: t.media.photosTitle },
    { href: '/video-gallery', label: t.media.videosTitle },
    { href: '/newsletter', label: t.media.newsletterTitle },
  ]

  const contactNav = { href: '/contact', label: t.nav.contact }

  return (
    <html
      lang={HTML_LANG[locale]}
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        {/* A thin gold rule under the navy header, the one piece of livery
            carried through every page. */}
        <header className="border-b-4 border-gold-300 bg-brand-800 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
            <Link
              href={localePath('/', locale)}
              className="flex items-center gap-3 leading-tight"
            >
              {/*
                The archdiocesan seal, taken from the old website. It is dark
                line art on a transparent background, so on this navy header it
                is knocked out to white -- see .seal-knockout in globals.css.
              */}
              <Image
                src="/brand/seal.png"
                alt=""
                width={48}
                height={48}
                className="seal-knockout size-11 shrink-0"
                priority
              />
              <span>
                <span className="block text-lg font-semibold tracking-tight">
                  {t.siteName}
                </span>
                <span className="block text-xs text-brand-200">{t.siteTagline}</span>
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-5">
              <nav aria-label={t.common.mainMenu}>
                <ul className="flex flex-wrap gap-5 text-sm">
                  {nav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={localePath(item.href, locale)}
                        className="text-brand-100 underline-offset-4 transition hover:text-gold-200 hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}

                  <li>
                    <NavMenu
                      label={t.media.menu}
                      items={mediaNav.map((item) => ({
                        href: localePath(item.href, locale),
                        label: item.label,
                      }))}
                    />
                  </li>

                  <li>
                    <Link
                      href={localePath(contactNav.href, locale)}
                      className="text-brand-100 underline-offset-4 transition hover:text-gold-200 hover:underline"
                    >
                      {contactNav.label}
                    </Link>
                  </li>
                </ul>
              </nav>

              <SearchForm
                locale={locale}
                id="header-search"
                label={t.search.title}
                placeholder={t.search.placeholder}
                submit={t.search.submit}
                compact
              />

              <LanguageSwitcher current={locale} label={t.common.switchLanguage} />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-16 border-t-4 border-gold-300 bg-brand-900 text-brand-100">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Image
                src="/brand/seal.png"
                alt=""
                width={44}
                height={44}
                className="seal-knockout size-10 shrink-0 opacity-80"
              />
              <div>
                <p className="font-semibold text-white">{t.siteName}</p>
                <p className="mt-1 text-sm">{t.siteTagline}</p>
              </div>
            </div>

            <div className="text-sm">
              <p className="font-semibold text-white">{OFFICE.name}</p>
              <address className="mt-1 space-y-0.5 not-italic">
                {OFFICE.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="mt-2">
                <a
                  href={`mailto:${OFFICE.email}`}
                  className="underline decoration-brand-400 underline-offset-2 hover:text-gold-200"
                >
                  {OFFICE.email}
                </a>
              </p>
            </div>

            <nav aria-label={t.common.footerMenu} className="text-sm">
              <ul className="space-y-1">
                {[...nav.slice(1), ...mediaNav, contactNav].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={localePath(item.href, locale)}
                      className="underline-offset-4 hover:text-gold-200 hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="border-t border-brand-700">
            <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-brand-300">
              {t.siteName}. {t.common.devPreview}
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}

export { DEFAULT_LOCALE }
