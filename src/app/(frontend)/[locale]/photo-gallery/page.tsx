import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  PhotoGallery,
  type GalleryAlbum,
  type GalleryPhoto,
} from '@/components/PhotoGallery'
import { LOCALES, alternatesFor, getDictionary, isLocale } from '@/lib/i18n'

/**
 * The photo gallery.
 *
 * A real route rather than a CMS page: the old one was a carousel plugin whose
 * markup did not survive the migration, leaving 47 photographs stacked down a
 * single page. See src/collections/Albums.ts for what is stored instead.
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/photo-gallery'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)

  return {
    title: t.media.photosTitle,
    description: t.media.photosIntro,
    alternates: alternatesFor('/photo-gallery', locale),
  }
}

type MediaLike = {
  id: number | string
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

/** A photo that resolved to a real record with a file behind it. */
const photoFrom = (value: unknown): GalleryPhoto | null => {
  if (typeof value !== 'object' || value === null || !('url' in value)) return null

  const media = value as MediaLike
  if (!media.url) return null

  return {
    id: String(media.id),
    url: media.url,
    alt: media.alt ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

export default async function PhotoGalleryRoute({
  params,
}: PageProps<'/[locale]/photo-gallery'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  const payload = await getPayload({ config })

  const result = await payload.find({
    overrideAccess: false,
    collection: 'albums',
    limit: 200,
    depth: 1,
    locale,
  })

  const dateFormat = new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  /**
   * Newest first, with undated albums after the dated ones in the order they
   * were added — the same rule as the video gallery, and for the same reason:
   * where a null sorts is not agreed between databases, and none of the five
   * albums carried over from the old site has a date yet.
   */
  const albums: GalleryAlbum[] = [...result.docs]
    .sort((a, b) => {
      if (a.heldOn && b.heldOn) {
        return new Date(b.heldOn).getTime() - new Date(a.heldOn).getTime()
      }
      if (a.heldOn) return -1
      if (b.heldOn) return 1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    .map((album) => ({
      id: String(album.id),
      title: album.title,
      description: album.description ?? null,
      date: album.heldOn ? dateFormat.format(new Date(album.heldOn)) : null,
      photos: (album.photos ?? [])
        .map(photoFrom)
        .filter((photo): photo is GalleryPhoto => photo !== null),
    }))
    // An album whose photographs have all been deleted would render as a
    // heading over nothing.
    .filter((album) => album.photos.length > 0)

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
          {t.media.photosTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t.media.photosIntro}</p>
      </header>

      {albums.length === 0 ? (
        <p className="text-slate-600">{t.media.photosEmpty}</p>
      ) : (
        <PhotoGallery
          albums={albums}
          labels={{
            open: t.media.openPhoto,
            close: t.media.closePhoto,
            previous: t.media.previousPhoto,
            next: t.media.nextPhoto,
            position: t.media.photoPosition,
            count: t.media.photoCount,
          }}
        />
      )}
    </div>
  )
}
