import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrStaff } from '@/access/roles'
import { legacyFields } from '@/fields/legacy'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/** The verse shows on the homepage, so a change has to rebuild it. */
const versePaths = (): string[] => ['/']

/**
 * The pool the homepage's "verse of the day" is drawn from.
 *
 * Why a collection rather than an API call
 * ----------------------------------------
 * The obvious implementation is to fetch a verse from a public Bible API each
 * day. Three reasons not to:
 *
 *  1. The archdiocese would be publishing scripture it has not chosen, in a
 *     translation it has not approved, with no way to intervene.
 *  2. Most modern translations (NRSV, NABRE, RSV-CE, the Jerusalem Bible) are
 *     under copyright. Reproducing them needs a licence.
 *  3. The old site's "Verse of the Day" and "Daily Readings" pages were both
 *     dead third-party widgets by the time it was migrated — exactly the
 *     failure mode an external dependency invites.
 *
 * So the verses live here, editable, with the translation recorded against
 * each one. The archdiocese can swap in its own approved translation without a
 * developer.
 *
 * This is NOT the lectionary. The homepage does not claim to show today's Mass
 * readings — working those out needs the liturgical calendar, the three-year
 * Sunday cycle and the two-year weekday cycle, and getting it wrong on a
 * diocesan website would be a real error. It is a verse for the day, labelled
 * as such.
 */
export const Verses: CollectionConfig = {
  slug: 'verses',
  labels: { singular: 'Verse', plural: 'Verse of the day' },
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'translation', 'active'],
    group: 'Content',
    description:
      'The homepage shows one of these each day, chosen by the date so it is the same verse for every visitor. Untick "active" to take one out of the rotation.',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(versePaths)],
    afterDelete: [revalidateAfterDelete(versePaths)],
  },
  fields: [
    {
      name: 'reference',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'e.g. "John 15:12". Shown under the verse.' },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      localized: true,
      admin: {
        description:
          'The verse itself, without the reference and without quotation marks — the page adds those.',
      },
    },
    {
      name: 'translation',
      type: 'text',
      localized: true,
      admin: {
        position: 'sidebar',
        description:
          'Which translation this wording comes from, e.g. "World English Bible". Shown in small print, because the archdiocese should be able to say where its scripture comes from.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Include this verse in the daily rotation.',
      },
    },
    ...legacyFields,
  ],
}
