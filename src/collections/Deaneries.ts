import type { CollectionConfig } from 'payload'
import { isEditor } from '@/access/roles'
import { deaneryPaths, revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/**
 * The archdiocese is divided into deaneries; each parish belongs to one.
 * The live site currently has these as ordinary blog posts, which is why
 * they cannot be filtered or listed automatically.
 */
export const Deaneries: CollectionConfig = {
  slug: 'deaneries',
  labels: { singular: 'Deanery', plural: 'Deaneries' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'dean'],
    group: 'Archdiocese',
  },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(deaneryPaths)],
    afterDelete: [revalidateAfterDelete(deaneryPaths)],
  },

  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Used in the URL, e.g. "sacred-heart-of-jesus".' },
    },
    {
      name: 'seat',
      type: 'text',
      admin: {
        description:
          'The place the deanery is seated, e.g. "Santhome". From the 2026 appointments letter.',
      },
    },
    {
      name: 'dean',
      type: 'relationship',
      relationTo: 'clergy',
      admin: {
        description:
          'The priest currently serving as Vicar Forane (Dean). Linked automatically where the name matches a clergy record.',
      },
    },
    {
      name: 'deanName',
      type: 'text',
      admin: {
        description:
          'The Dean as named in the appointments letter. Kept because not every dean has a clergy record yet — the old website only published profiles for priests A–H.',
      },
    },
    { name: 'description', type: 'textarea', localized: true },
  ],
}
