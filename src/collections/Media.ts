import type { CollectionConfig } from 'payload'
import { isEditor } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { MEDIA_DIR } from '@/lib/paths'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Administration' },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  upload: {
    // Named explicitly rather than left to default to `media` beside the
    // project root, so a deployment can move it onto a mounted disk.
    staticDir: MEDIA_DIR,
    // Generated once on upload, then served straight from disk.
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 400, position: 'centre' },
      { name: 'card', width: 768, height: 512, position: 'centre' },
      { name: 'hero', width: 1920, height: 1080, position: 'centre' },
    ],
    focalPoint: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'Describe the image for screen readers and for people on slow connections.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      admin: { description: 'Photographer or source, if it needs crediting.' },
    },
    ...legacyFields,
  ],
}
