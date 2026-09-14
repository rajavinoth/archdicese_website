import type { CollectionConfig } from 'payload'
import { canEditOwnParish, isEditor, publishedOrStaff } from '@/access/roles'
import { parishPaths, revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { legacyFields } from '@/fields/legacy'

const LANGUAGES = [
  { label: 'Tamil', value: 'tamil' },
  { label: 'English', value: 'english' },
  { label: 'Telugu', value: 'telugu' },
  { label: 'Hindi', value: 'hindi' },
  { label: 'Malayalam', value: 'malayalam' },
  { label: 'Latin', value: 'latin' },
]

const DAYS = [
  { label: 'Sunday', value: 'sunday' },
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
]

/**
 * The core record behind the parish finder. Latitude/longitude are plain
 * numbers rather than Payload's `point` type so the same schema works on
 * SQLite in development and Postgres in production.
 */
export const Parishes: CollectionConfig = {
  slug: 'parishes',
  labels: { singular: 'Parish', plural: 'Parishes' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'deanery', 'parishPriest', 'isShrine'],
    group: 'Archdiocese',
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    // A parish priest may edit their own parish, nothing else.
    update: canEditOwnParish,
    delete: isEditor,
  },
  hooks: {
    afterChange: [revalidateAfterChange(parishPaths)],
    afterDelete: [revalidateAfterDelete(parishPaths)],
  },

  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identity',
          fields: [
            { name: 'name', type: 'text', required: true, localized: true },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              index: true,
            },
            {
              name: 'patron',
              type: 'text',
              localized: true,
              admin: { description: 'Patron saint or dedication.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'deanery',
                  type: 'relationship',
                  relationTo: 'deaneries',
                  // Not required: parishes imported from the old site arrive
                  // without a known deanery and are flagged for review instead.
                  admin: { width: '50%' },
                },
                {
                  name: 'established',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy' },
                  },
                },
              ],
            },
            {
              name: 'isShrine',
              type: 'checkbox',
              label: 'This is a shrine or basilica',
              defaultValue: false,
            },
            { name: 'history', type: 'richText', localized: true },
            {
              name: 'photos',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Location & contact',
          fields: [
            {
              name: 'address',
              type: 'group',
              fields: [
                { name: 'line1', type: 'text' },
                { name: 'line2', type: 'text' },
                {
                  type: 'row',
                  fields: [
                    { name: 'city', type: 'text', admin: { width: '40%' } },
                    { name: 'district', type: 'text', admin: { width: '35%' } },
                    { name: 'pincode', type: 'text', admin: { width: '25%' } },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'latitude',
                  type: 'number',
                  admin: {
                    width: '50%',
                    description:
                      'Decimal degrees, e.g. 13.0336. Needed for the map.',
                  },
                },
                {
                  name: 'longitude',
                  type: 'number',
                  admin: { width: '50%', description: 'e.g. 80.2699' },
                },
              ],
            },
            {
              /**
               * How precise the coordinates above actually are.
               *
               * OpenStreetMap has only about thirty Catholic churches tagged
               * across the whole archdiocese, so most parishes can only be
               * placed at the centre of their locality. That is perfectly
               * useful for "find mass near me" — it is accurate to a few
               * hundred metres — but it is not the church door, and the page
               * must not imply otherwise.
               */
              name: 'locationPrecision',
              type: 'select',
              options: [
                { label: 'The church itself', value: 'church' },
                { label: 'Approximate — centre of the locality', value: 'locality' },
              ],
              admin: {
                description:
                  'Set automatically by the geocoder. "Approximate" shows a caveat on the parish page.',
              },
            },
            {
              type: 'row',
              fields: [
                { name: 'phone', type: 'text', admin: { width: '50%' } },
                { name: 'email', type: 'email', admin: { width: '50%' } },
              ],
            },
          ],
        },
        {
          label: 'Clergy',
          fields: [
            {
              name: 'parishPriest',
              type: 'relationship',
              relationTo: 'clergy',
            },
            {
              name: 'assistantPriests',
              type: 'relationship',
              relationTo: 'clergy',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Timings',
          description: 'These feed the mass-time finder. Add one row per service.',
          fields: [
            {
              /**
               * Marks the timings below as demonstration data.
               *
               * The site deliberately publishes no invented mass times — a
               * wrong one sends somebody to a locked church. This flag exists
               * so sample timings can be loaded to show the finder working,
               * while every page that displays them says plainly that they are
               * not the real schedule. `npm run timings:sample -- clear`
               * removes every set that carries it.
               */
              name: 'timingsAreSample',
              type: 'checkbox',
              label: 'These timings are sample data, not the real schedule',
              defaultValue: false,
              admin: {
                description:
                  'Loaded by npm run timings:sample to demonstrate the finder. Untick only when the timings below have been confirmed by the parish.',
              },
            },
            {
              name: 'services',
              type: 'array',
              labels: { singular: 'Service', plural: 'Services' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'kind',
                      type: 'select',
                      required: true,
                      defaultValue: 'mass',
                      admin: { width: '25%' },
                      options: [
                        { label: 'Mass', value: 'mass' },
                        { label: 'Novena', value: 'novena' },
                        { label: 'Adoration', value: 'adoration' },
                        { label: 'Confession', value: 'confession' },
                      ],
                    },
                    {
                      name: 'day',
                      type: 'select',
                      required: true,
                      admin: { width: '25%' },
                      options: DAYS,
                    },
                    {
                      name: 'time',
                      type: 'date',
                      required: true,
                      admin: {
                        width: '25%',
                        date: {
                          pickerAppearance: 'timeOnly',
                          displayFormat: 'h:mm a',
                        },
                      },
                    },
                    {
                      name: 'language',
                      type: 'select',
                      admin: { width: '25%' },
                      options: LANGUAGES,
                    },
                  ],
                },
                {
                  name: 'note',
                  type: 'text',
                  admin: {
                    description:
                      'Optional, e.g. "Vigil", "First Friday only", "Not during Lent".',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    ...legacyFields,
  ],
}
