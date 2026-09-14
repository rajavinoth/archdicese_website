import type { GlobalConfig } from 'payload'
import { isEditor } from '@/access/roles'
import { revalidateGlobalAfterChange } from '@/hooks/revalidate'

/**
 * The Archbishop page, as structured data rather than prose.
 *
 * Why this is not a CMS page like the rest
 * ----------------------------------------
 * On the old site this was a plugin tab set. Flattened into HTML it became one
 * 283-block page holding five unrelated things end to end — a profile table,
 * two lists of prelates, a set of photo cards, and four episcopal conferences
 * with their officers. Two of those sections had lost their pairing entirely:
 * every photo and name came first, then every biography, so no reader could
 * tell which details belonged to which bishop.
 *
 * No amount of clever rendering fixes that, because the association is simply
 * not in the document any more. The archdiocese supplied the correct data, and
 * it is modelled here so the pairing is explicit and stays that way.
 *
 * Everything is editable in the admin, which the flattened prose never really
 * was.
 */
export const ArchbishopPage: GlobalConfig = {
  slug: 'archbishop-page',
  label: 'Archbishop page',
  admin: {
    group: 'Settings',
    description:
      'The Archbishop’s profile, the former prelates, and the episcopal conferences. Shown at /archbishop.',
  },
  access: { read: () => true, update: isEditor },
  hooks: {
    afterChange: [revalidateGlobalAfterChange(['/', '/archbishop'])],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile',
          fields: [
            {
              name: 'portrait',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Photograph shown at the top of the page.' },
            },
            {
              name: 'profile',
              type: 'array',
              labels: { singular: 'Field', plural: 'Profile fields' },
              admin: { description: 'The label/value rows, e.g. "BORN ON" / "15th February 1952".' },
              fields: [
                { name: 'label', type: 'text', required: true },
                {
                  name: 'value',
                  type: 'textarea',
                  required: true,
                  localized: true,
                  admin: { description: 'One line per line of the value.' },
                },
              ],
            },
            {
              name: 'history',
              type: 'array',
              labels: { singular: 'Paragraph', plural: 'History' },
              fields: [{ name: 'text', type: 'textarea', required: true, localized: true }],
            },
          ],
        },
        {
          label: 'Former prelates',
          fields: [
            {
              name: 'successions',
              type: 'array',
              labels: { singular: 'Prelate', plural: 'Succession lists' },
              admin: {
                description:
                  'The two name-and-term lists. "Group" decides which tab a row appears under.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'group',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Former Prelates of Madras', value: 'madras' },
                        { label: 'Former Prelates of Mylapore', value: 'mylapore' },
                      ],
                      admin: { width: '40%' },
                    },
                    { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
                    { name: 'term', type: 'text', admin: { width: '20%' } },
                  ],
                },
              ],
            },
            {
              name: 'prelates',
              type: 'array',
              labels: { singular: 'Prelate', plural: 'Prelates of the Archdiocese' },
              admin: {
                description:
                  'Archbishops of Madras–Mylapore, each with their own photograph and dates.',
              },
              fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'image', type: 'upload', relationTo: 'media' },
                {
                  name: 'details',
                  type: 'textarea',
                  localized: true,
                  admin: { description: 'One date or fact per line.' },
                },
              ],
            },
          ],
        },
        {
          label: 'Conferences',
          fields: [
            {
              name: 'conferences',
              type: 'array',
              labels: { singular: 'Conference', plural: 'Conferences' },
              admin: { description: 'Each becomes a tab under "Conference" on the page.' },
              fields: [
                { name: 'name', type: 'text', required: true },
                {
                  name: 'shortName',
                  type: 'text',
                  admin: { description: 'The tab label, e.g. "FABC".' },
                },
                { name: 'blurb', type: 'textarea', localized: true },
                {
                  name: 'officers',
                  type: 'array',
                  labels: { singular: 'Officer', plural: 'Officers' },
                  fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'role', type: 'text' },
                    { name: 'image', type: 'upload', relationTo: 'media' },
                    {
                      name: 'fields',
                      type: 'array',
                      labels: { singular: 'Detail', plural: 'Contact details' },
                      fields: [
                        { name: 'label', type: 'text', required: true },
                        { name: 'value', type: 'textarea', required: true },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
