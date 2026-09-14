import type { GlobalConfig } from 'payload'
import { isEditor } from '@/access/roles'
import { revalidateGlobalAfterChange } from '@/hooks/revalidate'

/**
 * Homepage settings: the picture carousel and the verse panel.
 *
 * A Payload *global* rather than a collection, because there is exactly one
 * homepage. Globals appear in the admin sidebar as a single editable document,
 * so an editor changes the carousel without wondering which of several records
 * is the live one.
 *
 * Everything here is off unless it has content, and the page renders nothing
 * for an empty section — so a half-configured carousel cannot leave a blank
 * band across the homepage.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  admin: {
    group: 'Settings',
    description:
      'The picture carousel and the verse of the day, as they appear on the front page.',
  },
  access: { read: () => true, update: isEditor },
  hooks: {
    afterChange: [revalidateGlobalAfterChange(['/'])],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Carousel',
          fields: [
            {
              name: 'carouselEnabled',
              type: 'checkbox',
              label: 'Show the carousel',
              defaultValue: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'slidesToShow',
                  type: 'number',
                  label: 'How many slides to show',
                  defaultValue: 5,
                  min: 1,
                  max: 20,
                  admin: {
                    width: '33%',
                    description:
                      'Takes this many from the top of the list below, so slides can be kept ready without publishing them. Drag to reorder.',
                  },
                },
                {
                  name: 'slidesPerView',
                  type: 'select',
                  label: 'Slides visible at once',
                  defaultValue: '1',
                  options: [
                    { label: 'One large slide', value: '1' },
                    { label: 'Two side by side', value: '2' },
                    { label: 'Three side by side', value: '3' },
                  ],
                  admin: {
                    width: '33%',
                    description: 'Narrow screens always show one.',
                  },
                },
                {
                  name: 'autoplaySeconds',
                  type: 'number',
                  label: 'Advance every (seconds)',
                  defaultValue: 6,
                  min: 0,
                  max: 60,
                  admin: {
                    width: '33%',
                    description: '0 turns autoplay off and leaves the arrows.',
                  },
                },
              ],
            },
            {
              name: 'slides',
              type: 'array',
              labels: { singular: 'Slide', plural: 'Slides' },
              admin: {
                description:
                  'Landscape images work best — roughly twice as wide as they are tall.',
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'headline',
                  type: 'text',
                  localized: true,
                  admin: { description: 'Optional. Overlaid on the image.' },
                },
                {
                  name: 'caption',
                  type: 'text',
                  localized: true,
                  admin: { description: 'Optional second line.' },
                },
                {
                  name: 'link',
                  type: 'text',
                  admin: {
                    description:
                      'Optional. A path on this site such as /archbishop, or a full https:// address.',
                  },
                  validate: (value: unknown) => {
                    if (!value) return true
                    const text = String(value)
                    if (text.startsWith('/') || /^https?:\/\//.test(text)) return true
                    return 'Use a path starting with / or a full http(s):// address.'
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Verse of the day',
          fields: [
            {
              name: 'verseEnabled',
              type: 'checkbox',
              label: 'Show the verse of the day',
              defaultValue: true,
              admin: {
                description:
                  'The verses themselves are edited under Content → Verse of the day. One is chosen each day from the active ones, by date, so every visitor sees the same verse.',
              },
            },
          ],
        },
      ],
    },
  ],
}
