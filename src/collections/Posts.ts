import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

const postPaths = (doc: { slug?: string | null }): string[] => [
  '/',
  '/news',
  ...(doc.slug ? [`/news/${doc.slug}`] : []),
]

/** News and announcements. */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'News article', plural: 'News' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', '_status'],
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
    afterChange: [revalidateAfterChange(postPaths)],
    afterDelete: [revalidateAfterDelete(postPaths)],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    {
      name: 'excerpt',
      type: 'textarea',
      localized: true,
      admin: { description: 'Short summary used on listings and in search results.' },
    },
    { name: 'content', type: 'richText', localized: true },
    ...legacyFields,
  ],
}
