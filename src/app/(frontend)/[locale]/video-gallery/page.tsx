import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { VideoPlayer } from '@/components/VideoPlayer'
import { LOCALES, alternatesFor, fill, getDictionary, isLocale } from '@/lib/i18n'

/**
 * The video gallery.
 *
 * A real route rather than a CMS page: the old one was six `<iframe>` elements
 * pasted into the editor, which the migration could only turn into six naked
 * links. See src/collections/Videos.ts for what is stored instead, and
 * src/components/VideoPlayer.tsx for why nothing is loaded from YouTube until
 * a visitor presses play.
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/video-gallery'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.media.videosTitle,
    description: t.media.videosIntro,
    alternates: alternatesFor('/video-gallery', locale),
  }
}

type MediaLike = { url?: string | null }

const urlOf = (value: unknown): string | null =>
  typeof value === 'object' && value !== null && 'url' in value
    ? ((value as MediaLike).url ?? null)
    : null

export default async function VideoGalleryRoute({
  params,
}: PageProps<'/[locale]/video-gallery'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const result = await payload.find({
    overrideAccess: false,
    collection: 'videos',
    limit: 200,
    depth: 1,
    locale,
  })

  /**
   * Newest first, but videos without a date go last rather than first.
   *
   * Sorted here rather than in the query because "no date" has no agreed
   * position in SQL — whether a null sorts before or after a value differs
   * between databases, and this site is moving from SQLite to Postgres before
   * launch. Three of the six migrated videos have no date, so getting it wrong
   * would put the undated ones at the top of the page.
   */
  const videos = [...result.docs].sort((a, b) => {
    if (a.recordedOn && b.recordedOn) {
      return new Date(b.recordedOn).getTime() - new Date(a.recordedOn).getTime()
    }
    if (a.recordedOn) return -1
    if (b.recordedOn) return 1
    // Both undated: the order they were added, which for the migrated ones is
    // the order they appeared on the old page.
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const dateFormat = new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
          {t.media.videosTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t.media.videosIntro}</p>
      </header>

      {videos.length === 0 ? (
        <p className="text-slate-600">{t.media.videosEmpty}</p>
      ) : (
        <>
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <li key={video.id}>
                <VideoPlayer
                  youtubeId={video.youtubeId}
                  title={video.title}
                  thumbnailUrl={urlOf(video.thumbnail)}
                  playLabel={t.media.play}
                />

                <h2 className="mt-3 font-medium text-brand-900">{video.title}</h2>

                {video.description && (
                  <p className="mt-1 text-sm text-slate-600">{video.description}</p>
                )}

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  {video.recordedOn && (
                    <span>{dateFormat.format(new Date(video.recordedOn))}</span>
                  )}
                  {video.recordedOn && video.channel && <span aria-hidden="true">·</span>}
                  {/* Half of these were filmed and published by a Catholic
                      television channel, not by the archdiocese. Saying so is
                      both the credit owed and an accurate description. */}
                  {video.channel && (
                    <span>{fill(t.media.publishedBy, { channel: video.channel })}</span>
                  )}
                </p>

                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-xs text-brand-600 underline-offset-4 hover:underline"
                >
                  {t.media.watchOnYouTube}
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-12 border-t border-brand-100 pt-5 text-xs text-slate-500">
            {t.media.videoNotice}
          </p>
        </>
      )}
    </div>
  )
}
