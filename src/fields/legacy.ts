import type { Field } from 'payload'

/**
 * Provenance for anything imported from the old WordPress site.
 *
 * Two jobs:
 *   1. The importer upserts on `legacyWpId`, so `npm run wp:import` can be run
 *      repeatedly while the mapping is being refined without creating
 *      duplicates.
 *   2. `legacyUrl` is the source of the 301 redirect map at cutover -- the old
 *      site has ~132 indexed URLs and losing them would lose the search
 *      rankings with them.
 */
export const legacyFields: Field[] = [
  {
    name: 'legacy',
    type: 'group',
    label: 'Legacy (imported content)',
    admin: {
      description:
        'Filled in automatically by the WordPress importer. Safe to ignore when creating new content by hand.',
      position: 'sidebar',
    },
    fields: [
      {
        name: 'wpId',
        type: 'number',
        index: true,
        admin: { readOnly: true, description: 'WordPress post/page ID.' },
      },
      {
        name: 'url',
        type: 'text',
        admin: { readOnly: true, description: 'Original URL, for the redirect map.' },
      },
      {
        name: 'needsReview',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description:
            'Set by the importer when content could not be converted cleanly and a human should look at it.',
        },
      },
      {
        name: 'reviewNote',
        type: 'text',
        admin: { readOnly: true, condition: (_, sibling) => Boolean(sibling?.needsReview) },
      },
    ],
  },
]
