'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The photo gallery: albums of thumbnails, with a full-size viewer.
 *
 * What it replaces was 47 photographs stacked at full width down a single
 * page, because the carousel that used to hold them was a WordPress plugin and
 * did not survive the migration. Thumbnails mean the whole gallery is visible
 * at once; the viewer means a photograph can still be looked at properly.
 *
 * The viewer is a client component because it has to respond to clicks and
 * keys. Everything else on the page is rendered on the server.
 */

export type GalleryPhoto = {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
}

export type GalleryAlbum = {
  id: string
  title: string
  description: string | null
  date: string | null
  photos: GalleryPhoto[]
}

type Labels = {
  open: string
  close: string
  previous: string
  next: string
  /** Template with {index} and {total}. */
  position: string
  /** Template with {count}. */
  count: string
}

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className="size-6"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-7"
    aria-hidden="true"
  >
    <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

export const PhotoGallery = ({
  albums,
  labels,
}: {
  albums: GalleryAlbum[]
  labels: Labels
}) => {
  /** Which photograph the viewer is showing, or null when it is closed. */
  const [viewing, setViewing] = useState<{ album: number; photo: number } | null>(null)

  /**
   * The thumbnail that opened the viewer. Closing returns focus to it, so a
   * keyboard user is put back where they were rather than at the top of the
   * page.
   */
  const opener = useRef<HTMLButtonElement | null>(null)
  const closeButton = useRef<HTMLButtonElement | null>(null)

  const album = viewing === null ? null : albums[viewing.album]

  const close = useCallback(() => {
    setViewing(null)
    opener.current?.focus()
  }, [])

  /** Move within the current album, wrapping at both ends. */
  const step = useCallback(
    (by: number) => {
      setViewing((current) => {
        if (current === null) return current
        const photos = albums[current.album].photos
        const next = (current.photo + by + photos.length) % photos.length
        return { ...current, photo: next }
      })
    },
    [albums],
  )

  /**
   * Keys, and the page behind the viewer.
   *
   * The listener is only attached while the viewer is open, so Escape and the
   * arrow keys behave normally the rest of the time. `overflow: hidden` on the
   * document stops the page behind scrolling under the overlay — on a phone,
   * swiping an open photograph would otherwise scroll the gallery.
   */
  useEffect(() => {
    if (viewing === null) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    closeButton.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [viewing, close, step])

  const photo = album && viewing ? album.photos[viewing.photo] : null

  return (
    <>
      <div className="space-y-14">
        {albums.map((entry, albumIndex) => (
          <section key={entry.id}>
            <h2 className="text-xl font-semibold tracking-tight text-brand-900">
              {entry.title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {entry.date && <span className="mr-2">{entry.date}</span>}
              {labels.count.replace('{count}', String(entry.photos.length))}
            </p>

            {entry.description && (
              <p className="mt-2 max-w-2xl text-slate-600">{entry.description}</p>
            )}

            {/*
              Six across on a wide screen rather than the three or four a
              gallery would normally use. The photographs carried over from the
              old site are 150 pixels square — that is all it ever held — so a
              large tile would be an upscale of a thumbnail. Small tiles show
              them at close to their real size and look deliberate rather than
              broken. Wider columns will suit the originals when the
              archdiocese supplies them.
            */}
            <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {entry.photos.map((item, photoIndex) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={(event) => {
                      opener.current = event.currentTarget
                      setViewing({ album: albumIndex, photo: photoIndex })
                    }}
                    aria-label={`${labels.open}: ${item.alt || entry.title}`}
                    className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    <Image
                      src={item.url}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {photo && album && viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={album.title}
          // No backdrop-blur: it puts the overlay on its own compositing layer
          // for no visible gain behind a backdrop this dark.
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          // A click on the backdrop closes; a click on the photograph or the
          // controls does not, because those stop it reaching here.
          onClick={close}
        >
          <div className="flex shrink-0 items-center justify-between text-white">
            <p className="text-sm">
              {labels.position
                .replace('{index}', String(viewing.photo + 1))
                .replace('{total}', String(album.photos.length))}
            </p>

            <button
              ref={closeButton}
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="rounded-full p-2 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center gap-2 sm:gap-4">
            {album.photos.length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  step(-1)
                }}
                aria-label={labels.previous}
                className="shrink-0 rounded-full p-2 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronIcon direction="left" />
              </button>
            )}

            {/*
              The photograph at its own size, never stretched past it.

              A viewer normally fills the screen with the image. These images
              are 150 pixels square, and blowing one up to 900 would turn a
              small photograph into an unreadable one — so `width`/`height` are
              the file's real dimensions and the CSS only ever shrinks it to
              fit. A full-size photograph uploaded later fills the screen as
              you would expect.
            */}
            <div className="flex min-h-0 flex-1 items-center justify-center self-stretch">
              <Image
                src={photo.url}
                alt={photo.alt}
                width={photo.width ?? 1200}
                height={photo.height ?? 800}
                className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                priority
                /**
                 * Clicking the dark area closes the viewer, which is what
                 * people expect of one; clicking the photograph itself must
                 * not. Stopping the click here rather than on the box around
                 * the photograph matters, because that box is as tall as the
                 * screen — guarding it would mean the only part of the
                 * backdrop that closed was a strip at the very edge.
                 */
                onClick={(event) => event.stopPropagation()}
              />
            </div>

            {album.photos.length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  step(1)
                }}
                aria-label={labels.next}
                className="shrink-0 rounded-full p-2 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronIcon direction="right" />
              </button>
            )}
          </div>

          {/*
            No caption. `alt` is a description written for someone who cannot
            see the photograph, not a label to print under it — and for these
            it is a placeholder standing in for the filename the old site left
            behind. The album title above says what the visitor needs.
          */}
        </div>
      )}
    </>
  )
}
