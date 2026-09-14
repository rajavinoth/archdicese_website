'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * One video: a still image with a play button, which becomes the YouTube
 * player when pressed.
 *
 * Why not just embed it
 * ---------------------
 * The old page embedded all six videos directly. That meant every visitor
 * downloaded YouTube's player six times over before deciding whether to watch
 * anything — on a phone on mobile data, several megabytes for a page they may
 * have opened by mistake — and it meant YouTube was told who was reading the
 * archdiocese's website whether or not they pressed play.
 *
 * Here the page is a still image and a button until the visitor asks for the
 * video. The still is served from this site, so nothing is requested from
 * Google until that moment. `youtube-nocookie.com` is YouTube's own address
 * for embeds that do not set a tracking cookie before playback.
 *
 * `autoplay=1` is on the URL because by the time it is used the visitor has
 * already pressed play — without it they would have to press it twice.
 */
export const VideoPlayer = ({
  youtubeId,
  title,
  thumbnailUrl,
  playLabel,
}: {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  playLabel: string
}) => {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`${playLabel}: ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      )}

      {/* Darkened towards the bottom so the play mark stays visible on a
          bright still. */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent transition group-hover:from-black/60" />

      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-white/90 text-brand-800 shadow-lg transition group-hover:scale-110 group-hover:bg-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 size-7">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
