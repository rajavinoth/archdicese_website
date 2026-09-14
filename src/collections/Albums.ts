import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/** Every album appears on one page, so a change rebuilds that page. */
const albumPaths = (): string[] => ['/photo-gallery']

/**
 * A set of photographs from one occasion.
 *
 * The old photo gallery was a WordPress carousel plugin. The migration kept
 * the 47 photographs — they are all in the Media collection — but the carousel
 * markup went, leaving them stacked one above another at full width: a single
 * page you scrolled through 47 times, with no way to tell where one occasion
 * ended and the next began except the headings between them.
 *
 * Those headings were the albums all along. Making them real means the gallery
 * can show one tile per occasion, and means adding this year's photographs is
 * creating a record rather than editing a page.
 *
 * The photographs themselves stay in Media, where the alt text lives, rather
 * than being copied in here.
 */
export const Albums: CollectionConfig = {
  slug: 'albums',
  labels: { singular: 'Album', plural: 'Photo albums' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'heldOn'],
    group: 'Content',
    description: 'Sets of photographs shown on the photo gallery.',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(albumPaths)],
    afterDelete: [revalidateAfterDelete(albumPaths)],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'The occasion, e.g. "Archdiocesan Eucharistic Congress".' },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Optional. A line or two about the occasion.' },
    },
    {
      name: 'heldOn',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMMM yyyy' },
        description:
          'When it took place. Albums with a date are shown first, newest first; leave it blank if it is not known.',
      },
    },
    {
      name: 'photos',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      required: true,
      admin: {
        description:
          'The photographs, in the order they should appear. Each one needs alt text, which is set on the image itself.',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description:
          'The photograph used as the album’s tile. The first photograph is used if this is left blank.',
      },
    },
    ...legacyFields,
  ],
}
