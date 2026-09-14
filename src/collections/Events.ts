import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

const eventPaths = (doc: { slug?: string | null }): string[] => [
  '/',
  '/events',
  ...(doc.slug ? [`/events/${doc.slug}`] : []),
]

/**
 * The diocesan calendar — in practice largely the Archbishop's engagement
 * diary: masses, confirmations, ordinations, jubilees and appointments.
 *
 * Most of the migrated records are all-day entries, because that is how they
 * were entered on the old site.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startDate', 'location', '_status'],
    group: 'Content',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(eventPaths)],
    afterDelete: [revalidateAfterDelete(eventPaths)],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          index: true,
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, h:mm a' },
          },
        },
        {
          name: 'endDate',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, h:mm a' },
          },
        },
      ],
    },
    {
      name: 'allDay',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'When ticked the times are ignored and only the date is shown.',
      },
    },
    {
      name: 'location',
      type: 'text',
      localized: true,
      admin: { description: 'e.g. "San Thome Cathedral" or "Abp\'s House".' },
    },
    {
      name: 'parish',
      type: 'relationship',
      relationTo: 'parishes',
      admin: {
        position: 'sidebar',
        description: 'Optional, when the event is held at one of our parishes.',
      },
    },
    { name: 'description', type: 'richText', localized: true },
    ...legacyFields,
  ],
}
