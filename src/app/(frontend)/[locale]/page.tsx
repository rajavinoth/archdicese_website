import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { Carousel, type Slide } from '@/components/Carousel'
import { JsonLd } from '@/components/JsonLd'
import { formatEventDate } from '@/lib/events'
import { alternatesFor, fill, getDictionary, isLocale, localePath } from '@/lib/i18n'
import { graph, organizationSchema, websiteSchema } from '@/lib/structured-data'
import { pickForToday } from '@/lib/verse'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.home.heading,
    description: t.home.intro,
    alternates: alternatesFor('/', locale),
  }
}

const formatDate = (iso: string | null | undefined, locale: string) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const now = new Date().toISOString()

  const [parishes, clergy, deaneries, upcoming, recent, news, verses, homepage] =
    await Promise.all([
      payload.count({ collection: 'parishes', overrideAccess: false }),
      payload.count({ collection: 'clergy', overrideAccess: false }),
      payload.count({ collection: 'deaneries', overrideAccess: false }),
      payload.find({
        overrideAccess: false,
        collection: 'events',
        where: { startDate: { greater_than_equal: now } },
        sort: 'startDate',
        limit: 5,
        depth: 0,
        locale,
      }),
      /**
       * The archdiocese stopped updating its calendar in January 2025, so there
       * is nothing in the future to show. Rather than print an empty box, the
       * page falls back to the most recent entries and says plainly where the
       * calendar ends. As soon as a future engagement is entered, the block
       * above takes over and this one disappears.
       */
      payload.find({
        overrideAccess: false,
        collection: 'events',
        where: { startDate: { less_than: now } },
        sort: '-startDate',
        limit: 4,
        depth: 0,
        locale,
      }),
      payload.find({
        overrideAccess: false,
        collection: 'posts',
        sort: '-publishedAt',
        limit: 3,
        depth: 0,
        locale,
      }),
      payload.find({
        overrideAccess: false,
        collection: 'verses',
        where: { active: { equals: true } },
        // Stable order, so adding a verse does not reshuffle the rotation.
        sort: 'reference',
        limit: 500,
        depth: 0,
        locale,
      }),
      payload.findGlobal({ slug: 'homepage', depth: 1, locale }),
    ])

  const stats = [
    { label: t.home.statParishes, value: parishes.totalDocs, href: '/parishes' },
    { label: t.home.statPriests, value: clergy.totalDocs, href: '/clergy' },
    { label: t.home.statDeaneries, value: deaneries.totalDocs, href: '/parishes' },
  ]

  /**
   * Each card points at something that genuinely has content behind it, and
   * carries its own accent colour — the whole reason for the six liturgical
   * tokens in globals.css.
   */
  const cards = [
    { ...t.home.cards.parish, href: '/parishes', accent: 'bg-accent-parish' },
    { ...t.home.cards.clergy, href: '/clergy', accent: 'bg-accent-clergy' },
    { ...t.home.cards.certificate, href: '/contact', accent: 'bg-accent-sacrament' },
    { ...t.home.cards.forms, href: '/forms', accent: 'bg-accent-forms' },
    { ...t.home.cards.archbishop, href: '/archbishop', accent: 'bg-accent-bishop' },
    {
      ...t.home.cards.history,
      href: '/history-of-archdiocese',
      accent: 'bg-accent-history',
    },
  ]

  const calendarEntries = upcoming.docs.length > 0 ? upcoming.docs : recent.docs
  const isUpcoming = upcoming.docs.length > 0
  const lastEntry = recent.docs[0]

  /** One verse per day, the same for every visitor. See src/lib/verse.ts. */
  const verse = homepage.verseEnabled ? pickForToday(verses.docs) : null

  /**
   * `slidesToShow` lets an editor keep extra slides in the list without
   * publishing them, so only the first N are taken.
   */
  const slides: Slide[] = homepage.carouselEnabled
    ? (homepage.slides ?? [])
        .slice(0, homepage.slidesToShow ?? 5)
        .flatMap((entry): Slide[] => {
          const image = entry.image
          if (typeof image !== 'object' || image === null || !image.url) return []

          return [
            {
              id: String(entry.id ?? image.id),
              src: image.url,
              width: image.width ?? 1600,
              height: image.height ?? 900,
              // The headline is decoration over the picture; the alt text has
              // to stand on its own for anyone who cannot see it.
              alt: image.alt || entry.headline || '',
              headline: entry.headline ?? null,
              caption: entry.caption ?? null,
              href: entry.link ?? null,
            },
          ]
        })
    : []

  const perView = Number(homepage.slidesPerView ?? '1')

  return (
    <>
      {/* Identifies the archdiocese and declares the site search endpoint. */}
      <JsonLd
        data={graph(organizationSchema(t.siteName), websiteSchema(t.siteName, locale))}
      />

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-brand-800 text-white">
        {/* A soft radial wash so the navy is not a flat slab. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,var(--color-brand-600),transparent_55%),radial-gradient(circle_at_85%_120%,var(--color-accent-clergy),transparent_50%)] opacity-70"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-medium tracking-[0.18em] text-gold-300 uppercase">
              {t.home.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {t.home.heading}
            </h1>
            <p className="mt-5 text-lg text-brand-100">{t.home.intro}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={localePath('/parishes', locale)}
                className="rounded-md bg-gold-300 px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-gold-200"
              >
                {t.home.findParish}
              </Link>
              <Link
                href={localePath('/clergy', locale)}
                className="rounded-md border border-white/35 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/70 hover:bg-white/10"
              >
                {t.home.clergyDirectory}
              </Link>
            </div>
          </div>

          {/* Counts sit in the hero so the page opens with something concrete. */}
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={localePath(stat.href, locale)}
                className="rounded-lg border border-white/15 bg-white/5 p-5 backdrop-blur-sm transition hover:border-gold-300/60 hover:bg-white/10"
              >
                <span className="block text-3xl font-semibold tabular-nums text-gold-200">
                  {stat.value}
                </span>
                <span className="mt-1 block text-sm text-brand-100">{stat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        {/* ---- Carousel ------------------------------------------------ */}
        {slides.length > 0 && (
          <div className="-mt-8 sm:-mt-10">
            <Carousel
              slides={slides}
              perView={perView}
              autoplaySeconds={homepage.autoplaySeconds ?? 0}
              labels={{
                region: t.home.carouselRegion,
                previous: t.home.carouselPrevious,
                next: t.home.carouselNext,
                goTo: t.home.carouselGoTo,
              }}
            />
          </div>
        )}

        {/* ---- Verse of the day ---------------------------------------- */}
        {verse && (
          <section className="mt-14 overflow-hidden rounded-xl border border-gold-200 bg-gradient-to-br from-cream-100 to-gold-50 p-7 sm:p-9">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-gold-600 uppercase">
              {t.home.verseTitle}
            </h2>
            <blockquote className="mt-4">
              <p className="text-xl leading-relaxed font-medium text-brand-900 sm:text-2xl">
                &ldquo;{verse.text}&rdquo;
              </p>
              <footer className="mt-4 flex flex-wrap items-baseline gap-x-3 text-sm">
                <cite className="font-semibold text-brand-700 not-italic">
                  {verse.reference}
                </cite>
                {verse.translation && (
                  <span className="text-brand-400">{verse.translation}</span>
                )}
              </footer>
            </blockquote>
            <p className="mt-5 text-xs text-brand-400">{t.home.verseNote}</p>
          </section>
        )}

        {/* ---- How can we help ----------------------------------------- */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-brand-900">
            {t.home.help}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={localePath(card.href, locale)}
                className="group relative overflow-hidden rounded-xl border border-brand-100 bg-white p-5 pl-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                {/* The accent stripe is what makes six identical cards
                    readable at a glance. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1.5 ${card.accent}`}
                />
                <h3 className="font-semibold text-brand-900 group-hover:underline">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">{card.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {/* ---- Diocesan calendar ------------------------------------- */}
          <section>
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-brand-100 pb-2">
              <h2 className="text-xl font-semibold tracking-tight text-brand-900">
                {t.home.calendar}
              </h2>
              <Link
                href={localePath('/events', locale)}
                className="text-sm font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-800"
              >
                {fill(t.home.allEvents, { count: recent.totalDocs })}
              </Link>
            </div>

            <h3 className="mt-4 text-sm font-semibold tracking-wide text-brand-500 uppercase">
              {isUpcoming ? t.home.upcoming : t.home.recentEntries}
            </h3>

            {!isUpcoming && (
              <p className="mt-1 text-sm text-slate-500">
                {t.home.noUpcoming}{' '}
                {lastEntry &&
                  fill(t.home.calendarEnds, {
                    date: formatDate(lastEntry.startDate, locale) ?? '',
                  })}
              </p>
            )}

            <ul className="mt-3 space-y-2">
              {calendarEntries.map((event) => (
                <li
                  key={event.id}
                  className="rounded-lg border border-brand-50 bg-cream-50 p-3 transition hover:border-brand-200"
                >
                  <p className="text-xs font-medium text-accent-bishop">
                    {formatEventDate(event.startDate, Boolean(event.allDay), locale)}
                  </p>
                  <h4 className="mt-0.5 font-medium text-brand-900">
                    <Link
                      href={`${localePath('/events', locale)}/${event.slug}`}
                      className="hover:underline"
                    >
                      {event.title}
                    </Link>
                  </h4>
                  {event.location && (
                    <p className="mt-0.5 text-sm text-slate-600">{event.location}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ---- News -------------------------------------------------- */}
          <section>
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-brand-100 pb-2">
              <h2 className="text-xl font-semibold tracking-tight text-brand-900">
                {t.home.latestNews}
              </h2>
              <Link
                href={localePath('/news', locale)}
                className="text-sm font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-800"
              >
                {t.home.allNews}
              </Link>
            </div>

            {news.docs.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-brand-200 bg-cream-50 p-6 text-sm text-slate-500">
                {t.home.noNews}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {news.docs.map((post) => {
                  const date = formatDate(post.publishedAt, locale)
                  return (
                    <li
                      key={post.id}
                      className="rounded-lg border border-brand-50 bg-cream-50 p-3 transition hover:border-brand-200"
                    >
                      {date && (
                        <p className="text-xs font-medium text-accent-sacrament">{date}</p>
                      )}
                      <h3 className="mt-0.5 font-medium text-brand-900">
                        <Link
                          href={`${localePath('/news', locale)}/${post.slug}`}
                          className="hover:underline"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      {/* The importer derived excerpts from the body, so a
                          title-only post ends up with an excerpt identical to
                          its own heading. Printing it twice looks like a bug. */}
                      {post.excerpt && post.excerpt.trim() !== post.title.trim() && (
                        <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-16 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <h2 className="font-semibold">Development preview</h2>
          <p className="mt-2">
            Everything shown is taken from the archdiocese&apos;s own published
            material — the previous website and the 2026 appointments letter.
            Nothing is invented: where a detail has not been published, the field
            is simply empty. That is why parishes do not yet show addresses, map
            locations or mass timings.
          </p>
          <p className="mt-2">
            Ten of the eleven news posts on the old site have been unpublished:
            six were the WordPress theme&apos;s demo articles, written by other
            publishers and never removed, and four were empty. They are kept as
            drafts in the admin panel with the reason on each one.
          </p>
          <p className="mt-2">
            The verses are given in the public-domain World English Bible and are
            all flagged for review — the wording should be checked, and the
            archdiocese may prefer its own approved translation.
          </p>
          <p className="mt-2">
            The Tamil translation of the interface is a first pass and needs review
            by a Tamil speaker. Page content falls back to English until translated.
          </p>
        </section>
      </div>
    </>
  )
}
