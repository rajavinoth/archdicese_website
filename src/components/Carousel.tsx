'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

/**
 * Homepage picture carousel.
 *
 * A client component because it has to respond to clicks and run a timer, but
 * everything it needs is passed in from the server — the slide list, how many
 * to show at once and the autoplay interval all come from the Homepage global,
 * so an editor changes the behaviour without touching code.
 *
 * Written by hand rather than pulled from a carousel library. The behaviour
 * wanted here is small (advance, go back, dots, autoplay) and the libraries
 * that do it well are 30-50kB of JavaScript on the most-visited page of the
 * site. What they mostly add beyond this is momentum-scrolling physics, which
 * a CSS scroll-snap track already gives for free.
 *
 * Accessibility, which is where hand-rolled carousels usually fall down:
 *  - the track is a labelled region with aria-roledescription="carousel"
 *  - autoplay stops on hover, on focus, and when the tab is hidden, so it can
 *    never move the thing you are reading or about to click
 *  - autoplay never starts for a visitor who has asked for reduced motion
 *  - arrows and dots are real buttons, reachable and labelled
 *  - slides that are scrolled out of view are hidden from the accessibility
 *    tree and taken out of the tab order
 */

export type Slide = {
  id: string
  src: string
  width: number
  height: number
  alt: string
  headline: string | null
  caption: string | null
  href: string | null
}

type Props = {
  slides: Slide[]
  /** 1, 2 or 3 — how many slides are visible side by side on a wide screen. */
  perView: number
  /** Seconds between advances; 0 disables autoplay. */
  autoplaySeconds: number
  labels: {
    region: string
    previous: string
    next: string
    /** Template with {n} and {total}. */
    goTo: string
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  )

export const Carousel = ({ slides, perView, autoplaySeconds, labels }: Props) => {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  /**
   * How many distinct scroll positions there are. With two slides visible and
   * four slides there are three positions, not four — otherwise the last
   * "page" is half empty and the dots lie about where you can go.
   */
  const pages = Math.max(1, slides.length - perView + 1)

  /**
   * Scroll the track rather than transform it, so the browser's own scroll
   * snapping handles swipes and keyboard scrolling for free.
   *
   * `scrollIntoView` rather than `scrollTo` with arithmetic: a child's
   * `offsetLeft` is measured from its nearest *positioned* ancestor, which
   * here is the wrapper that holds the arrows, not the scroll container. The
   * subtraction happens to come out right today and would break silently the
   * moment the markup around it changed. `block: 'nearest'` keeps it from
   * scrolling the page vertically as a side effect.
   */
  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current
      if (!track) return

      const target = ((next % pages) + pages) % pages
      const slide = track.children[target] as HTMLElement | undefined
      if (!slide) return

      const before = track.scrollLeft
      slide.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' })
      setIndex(target)

      /**
       * Guarantee the slide actually changes.
       *
       * A smooth scroll is a request, not a promise: the browser may decline
       * to animate it, and some embedded and headless browsers drop the
       * animation entirely — in which case the arrows would update the dots
       * and then sit there doing nothing, which reads as a broken site. If
       * nothing has moved shortly after, the position is set outright. A
       * normal browser has already started moving by then, so this never
       * fights a running animation.
       */
      window.setTimeout(() => {
        const current = trackRef.current
        if (!current || current.scrollLeft !== before) return
        const destination = current.children[target] as HTMLElement | undefined
        // 'instant', not 'auto' — `auto` defers to the CSS `scroll-behavior`,
        // which is `smooth` here, so it would just fail the same way again.
        destination?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' })
      }, 240)
    },
    [pages],
  )

  /**
   * Keep the dots honest when someone swipes or drags the track directly:
   * whichever slide is nearest the left edge is the current one.
   */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const children = Array.from(track.children) as HTMLElement[]
        let nearest = 0
        let best = Infinity
        children.forEach((child, position) => {
          const distance = Math.abs(child.offsetLeft - track.offsetLeft - track.scrollLeft)
          if (distance < best) {
            best = distance
            nearest = position
          }
        })
        setIndex(Math.min(nearest, pages - 1))
      })
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [pages])

  /** Autoplay. */
  useEffect(() => {
    if (autoplaySeconds <= 0 || paused || pages <= 1) return

    // Respect the OS-level setting rather than animating over someone's wishes.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return

    const timer = window.setInterval(() => {
      // Don't advance a carousel nobody is looking at.
      if (document.hidden) return
      goTo(index + 1)
    }, autoplaySeconds * 1000)

    return () => window.clearInterval(timer)
  }, [autoplaySeconds, paused, index, pages, goTo])

  if (slides.length === 0) return null

  const widthClass =
    perView === 3 ? 'sm:basis-1/2 lg:basis-1/3' : perView === 2 ? 'sm:basis-1/2' : 'basis-full'

  /**
   * A single full-width slide at 16:9 is over 600px tall on a laptop, which
   * pushes everything else on the homepage below the fold. Wider and shallower
   * reads as a banner rather than a poster; the smaller boxes of a two- or
   * three-up carousel have no such problem and keep a normal photo ratio.
   */
  const ratioClass =
    perView === 1
      ? // 21:9 across a phone is only ~160px tall, which crops a person's head
        // off and reads as a letterbox strip, so narrow screens keep 16:9.
        'aspect-[16/9] sm:aspect-[21/9] sm:max-h-[460px]'
      : 'aspect-[16/10]'

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((slide, position) => {
          // A slide scrolled out of view should not be tabbable or read out.
          const visible = position >= index && position < index + perView

          const media = (
            <>
              <Image
                src={slide.src}
                alt={slide.alt}
                width={slide.width}
                height={slide.height}
                className="h-full w-full object-cover"
                priority={position === 0}
                sizes={
                  perView === 1
                    ? '(max-width: 640px) 100vw, 1152px'
                    : '(max-width: 640px) 100vw, 576px'
                }
              />
              {(slide.headline || slide.caption) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-900/85 via-brand-900/45 to-transparent p-5 pt-14 text-white">
                  {slide.headline && (
                    <h3 className="text-lg font-semibold tracking-tight drop-shadow-sm sm:text-xl">
                      {slide.headline}
                    </h3>
                  )}
                  {slide.caption && (
                    <p className="mt-1 text-sm text-white/85">{slide.caption}</p>
                  )}
                </div>
              )}
            </>
          )

          return (
            <li
              key={slide.id}
              aria-hidden={!visible}
              className={`relative shrink-0 grow-0 basis-full snap-start overflow-hidden rounded-xl bg-brand-900 shadow-sm ring-1 ring-brand-900/10 ${widthClass}`}
            >
              <div className={`relative ${ratioClass}`}>
                {slide.href ? (
                  slide.href.startsWith('/') ? (
                    <Link
                      href={slide.href}
                      tabIndex={visible ? 0 : -1}
                      className="block h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
                    >
                      {media}
                    </Link>
                  ) : (
                    <a
                      href={slide.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={visible ? 0 : -1}
                      className="block h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
                    >
                      {media}
                    </a>
                  )
                ) : (
                  media
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pages > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label={labels.previous}
            className="absolute top-1/2 left-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-800 shadow-md ring-1 ring-brand-900/10 transition hover:bg-white sm:flex"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ‹
            </span>
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label={labels.next}
            className="absolute top-1/2 right-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-800 shadow-md ring-1 ring-brand-900/10 transition hover:bg-white sm:flex"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ›
            </span>
          </button>

          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, position) => (
              <button
                key={position}
                type="button"
                onClick={() => goTo(position)}
                aria-label={fill(labels.goTo, { n: position + 1, total: pages })}
                aria-current={position === index}
                className={`h-2 rounded-full transition-all ${
                  position === index
                    ? 'w-6 bg-brand-700'
                    : 'w-2 bg-brand-200 hover:bg-brand-300'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
