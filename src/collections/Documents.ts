import type { CollectionConfig } from 'payload'
import { isEditor } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { DOCUMENTS_DIR } from '@/lib/paths'

/**
 * Downloadable files: the marriage and baptism forms, the newsletter, the FCRA
 * report.
 *
 * Separate from Media rather than sharing it, for two reasons. Media is an
 * image collection — it generates three resized versions of everything and
 * requires `alt` text, neither of which means anything for a PDF. And these
 * files are the point of the page they sit on, so they need a title, a
 * language and a description that an image caption would not carry.
 *
 * Until now these forms were links into the old WordPress site's uploads
 * folder. That works right up until the old site is switched off, at which
 * point every form on the archdiocese's site 404s. Holding the files here
 * means the new site owns them.
 */
export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'issueDate', 'language', 'filesize'],
    group: 'Content',
    description:
      'PDFs and other files offered for download. Attach them to a page under that page’s "Documents" field.',
  },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  upload: {
    staticDir: DOCUMENTS_DIR,
    // No imageSizes: resizing a PDF is meaningless and Payload would try.
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      admin: {
        description: 'What the download is called on the page, e.g. "Baptism Extract".',
      },
    },
    {
      name: 'description',
      type: 'text',
      localized: true,
      admin: { description: 'Optional one-line explanation shown under the title.' },
    },
    {
      /**
       * What kind of download this is. The forms sit on a page and are found
       * through it; the newsletter is an archive of its own, queried by this
       * field rather than attached one by one to a page that would then need
       * editing every month.
       *
       * Optional on purpose: the twelve forms imported before this field
       * existed have no value, and making it required would stop an editor
       * saving any of them until they had filled it in.
       */
      name: 'category',
      type: 'select',
      defaultValue: 'form',
      options: [
        { label: 'Form', value: 'form' },
        { label: 'Newsletter', value: 'newsletter' },
        { label: 'Report', value: 'report' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Newsletters appear on /newsletter, grouped by year.',
      },
    },
    {
      /**
       * Which month an issue belongs to. Stored as midday UTC on the first of
       * the month so that reading the year back with `getUTCFullYear()` gives
       * the same answer in every timezone — an issue dated midnight on 1
       * January would be December of the previous year to a reader west of
       * Greenwich, which would file it under the wrong tab.
       */
      name: 'issueDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'monthOnly', displayFormat: 'MMMM yyyy' },
        condition: (data) => data?.category === 'newsletter',
        description: 'The month this issue covers.',
      },
    },
    {
      name: 'language',
      type: 'select',
      options: [
        { label: 'English', value: 'english' },
        { label: 'Tamil', value: 'tamil' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'The language of the document itself — several forms exist in both.',
      },
    },
    ...legacyFields,
  ],
}
