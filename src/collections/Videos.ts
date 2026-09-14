import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/** Every video appears on one page, so a change rebuilds that page. */
const videoPaths = (): string[] => ['/video-gallery']

/**
 * Videos published by the archdiocese, each one hosted on YouTube.
 *
 * Only the YouTube id is stored, not an embed. The old site pasted six
 * `<iframe>` elements into a page, which had three consequences: the migration
 * could not carry them across at all (Lexical has no iframe node, so all six
 * became naked `https://youtube.com/embed/...` links and nothing played), the
 * page loaded roughly a megabyte of YouTube's player six times over before a
 * visitor had asked for anything, and YouTube was told who was reading the
 * archdiocese's website whether or not they watched.
 *
 * Holding the id lets the site render a still image and load the player only
 * when someone presses play — see src/components/VideoGallery.tsx.
 *
 * The thumbnail is stored here too rather than hot-linked from YouTube, for
 * the same reason: a page of thumbnails served from i.ytimg.com is a page that
 * reports every one of its readers to Google before they have clicked
 * anything.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video', plural: 'Videos' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'recordedOn', 'youtubeId'],
    group: 'Content',
    description: 'Videos shown on the video gallery, newest first.',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(videoPaths)],
    afterDelete: [revalidateAfterDelete(videoPaths)],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'What the video is called on the page.' },
    },
    {
      name: 'youtubeId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'The id from the YouTube address — the part after "watch?v=". Pasting the whole address works too.',
      },
      hooks: {
        /**
         * Anyone filling this in will have a YouTube address on the clipboard,
         * not an id. Rather than ask them to edit it down by hand — and get a
         * blank player when they trim one character too many — take whichever
         * they give us. Covers the watch, embed, shorts, live and youtu.be
         * forms.
         */
        beforeValidate: [
          ({ value }) => {
            if (typeof value !== 'string') return value

            const input = value.trim()
            if (!input) return input

            const match = input.match(
              /(?:youtu\.be\/|\/(?:embed|shorts|live|v)\/|[?&]v=)([A-Za-z0-9_-]{11})/,
            )
            return match ? match[1] : input
          },
        ],
      },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(value.trim())) {
          return 'That does not look like a YouTube video address or id.'
        }
        return true
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Optional. One or two lines shown under the title.' },
    },
    {
      /**
       * Not every video of an archdiocesan celebration was published by the
       * archdiocese — three of the six carried over from the old site belong
       * to a Catholic television channel. Naming the channel is both the
       * courtesy owed to whoever filmed it and an honest statement of what the
       * page is showing.
       */
      name: 'channel',
      type: 'text',
      admin: {
        description: 'The YouTube channel that published it. Shown as a credit.',
      },
    },
    {
      name: 'recordedOn',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMMM yyyy' },
        description:
          'When the video was recorded. Videos with a date are shown first, newest first; leave it blank if it is not known.',
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description:
          'The still shown before the video is played. The importer takes this from YouTube; for a new video, a frame from the video itself works well.',
      },
    },
    ...legacyFields,
  ],
}
