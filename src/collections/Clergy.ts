import type { CollectionConfig } from 'payload'
import { contactVisible, isEditor, publishedOrStaff } from '@/access/roles'
import { clergyPaths, revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { legacyFields } from '@/fields/legacy'

const LANGUAGES = [
  { label: 'Tamil', value: 'tamil' },
  { label: 'English', value: 'english' },
  { label: 'Telugu', value: 'telugu' },
  { label: 'Hindi', value: 'hindi' },
  { label: 'Malayalam', value: 'malayalam' },
  { label: 'Latin', value: 'latin' },
]

/**
 * One record per priest, replacing the ~47 hand-built "/fr-..." pages on the
 * current site. Because these are structured records they can be searched,
 * filtered by deanery, and driven by the annual transfer list.
 */
export const Clergy: CollectionConfig = {
  slug: 'clergy',
  labels: { singular: 'Priest', plural: 'Clergy' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'currentAssignment', 'ordinationDate'],
    group: 'Archdiocese',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  // Refresh the directory and this priest's page whenever the record changes.
  hooks: {
    afterChange: [revalidateAfterChange(clergyPaths)],
    afterDelete: [revalidateAfterDelete(clergyPaths)],
  },

  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'honorific',
                  type: 'select',
                  required: true,
                  defaultValue: 'fr',
                  admin: { width: '30%' },
                  options: [
                    { label: 'Fr.', value: 'fr' },
                    { label: 'Msgr.', value: 'msgr' },
                    { label: 'Most Rev.', value: 'mostRev' },
                    { label: 'Rev.', value: 'rev' },
                  ],
                },
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  localized: true,
                  admin: {
                    width: '70%',
                    description: 'Name without the honorific, e.g. "A. Amal Raj".',
                  },
                },
              ],
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              admin: { description: 'URL segment, e.g. "a-amal-raj".' },
            },
            { name: 'photo', type: 'upload', relationTo: 'media' },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'active',
              options: [
                { label: 'In active ministry', value: 'active' },
                { label: 'Retired', value: 'retired' },
                { label: 'On studies / outside the archdiocese', value: 'away' },
                // The 2026 appointments letter lists "On leave" separately from
                // higher studies, and "away" would misdescribe it.
                { label: 'On leave', value: 'onLeave' },
                { label: 'Deceased', value: 'deceased' },
              ],
            },
            {
              name: 'bio',
              type: 'richText',
              localized: true,
              admin: { description: 'Optional short biography.' },
            },
          ],
        },
        {
          label: 'Ministry',
          fields: [
            {
              name: 'currentAssignment',
              type: 'text',
              localized: true,
              admin: {
                description:
                  'Free text, e.g. "Parish Priest, St Mark\'s" or "Chancellor".',
              },
            },
            {
              name: 'parish',
              type: 'relationship',
              relationTo: 'parishes',
              admin: { description: 'Link to the parish, when applicable.' },
            },
            {
              name: 'deanery',
              type: 'relationship',
              relationTo: 'deaneries',
              admin: { description: 'Used to filter the clergy directory.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'ordinationDate',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
                  },
                },
                {
                  name: 'dateOfBirth',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
                  },
                },
              ],
            },
            {
              name: 'languages',
              type: 'select',
              hasMany: true,
              options: LANGUAGES,
            },
            {
              name: 'assignmentHistory',
              type: 'array',
              labels: { singular: 'Assignment', plural: 'Assignments' },
              admin: {
                description:
                  'Previous postings. Populated automatically when transfer lists are imported.',
              },
              fields: [
                { name: 'role', type: 'text', required: true },
                { name: 'place', type: 'text' },
                {
                  type: 'row',
                  fields: [
                    { name: 'from', type: 'date', admin: { width: '50%' } },
                    { name: 'to', type: 'date', admin: { width: '50%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            {
              name: 'contactPublic',
              type: 'checkbox',
              label: 'Show contact details on the public website',
              defaultValue: false,
              admin: {
                description:
                  'Off by default. Contact details stay private unless this is ticked.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'email',
                  type: 'email',
                  access: { read: contactVisible },
                  admin: { width: '50%' },
                },
                {
                  name: 'phone',
                  type: 'text',
                  access: { read: contactVisible },
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'residenceAddress',
              type: 'textarea',
              access: { read: contactVisible },
              admin: {
                description:
                  'Also governed by the checkbox above -- hidden from the public site unless it is ticked.',
              },
            },
          ],
        },
      ],
    },
    ...legacyFields,
  ],
}
