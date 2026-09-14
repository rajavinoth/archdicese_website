import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

const pagePaths = (doc: { slug?: string | null }): string[] =>
  doc.slug ? [`/${doc.slug}`] : []

/**
 * Generic content pages: the resource and information pages from the old site
 * (Bible, Catechism, Canon Law, Vatican documents, CBCI links, FCRA report,
 * newsletters, and so on).
 *
 * Parishes, clergy and news each have their own collection because they are
 * structured records. Everything else that is simply "a page with words on it"
 * lives here.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status'],
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
    afterChange: [revalidateAfterChange(pagePaths)],
    afterDelete: [revalidateAfterDelete(pagePaths)],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL path, e.g. "the-bible" becomes /the-bible.' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'pages',
      admin: {
        position: 'sidebar',
        description: 'Optional, used to group pages in navigation.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      localized: true,
      admin: { description: 'Used for search results and link previews.' },
    },
    {
      /**
       * Several pages on the old site were not content pages at all: they held
       * a single link to a resource hosted elsewhere (the Bible, Catechism and
       * Canon Law on vatican.va, reflections on cbci.in). When this is set the
       * page renders as a link to that resource instead of a body of text,
       * which is what the original page actually did.
       */
      name: 'externalUrl',
      type: 'text',
      label: 'External resource URL',
      admin: {
        description:
          'If this page exists only to point at a resource on another website, put that address here.',
      },
      validate: (value: unknown) => {
        if (!value) return true
        return /^https?:\/\//i.test(String(value))
          ? true
          : 'Enter a full address starting with http:// or https://'
      },
    },
    { name: 'content', type: 'richText', localized: true },
    {
      /**
       * Marks this language's version of the page as a machine translation
       * awaiting a human read.
       *
       * Localized on purpose: it is a fact about one translation, not about the
       * page. The English original is never flagged; the Tamil version is,
       * until a Tamil speaker has been through it and unticks this.
       */
      name: 'translationNeedsReview',
      type: 'checkbox',
      label: 'This translation still needs review',
      localized: true,
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Shows a notice at the top of the page in this language. Untick once a fluent speaker has checked the text.',
      },
    },
    {
      /**
       * Downloads offered by this page, shown as cards beneath the text.
       *
       * A page like /forms is a document library, not an article. As migrated
       * WordPress prose it rendered as a bare alternating list — a title, the
       * word "Download", a title, the word "Download" — with no spacing and no
       * indication of what any file was. Holding the files as real records
       * instead means the page can show the type, the size and the language,
       * and the order can be changed by dragging.
       */
      name: 'documents',
      type: 'upload',
      relationTo: 'documents',
      hasMany: true,
      admin: {
        description:
          'Files offered for download on this page. Drag to reorder — that is the order visitors see.',
      },
    },
    ...legacyFields,
  ],
}
