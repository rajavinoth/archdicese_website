/**
 * Unpublishes the "news" articles that are not the archdiocese's own content.
 *
 * Why this exists
 * ---------------
 * The migration brought across 11 news posts. Reading them shows that only one
 * is genuinely the archdiocese's, and six are the WordPress theme's demo
 * content that was never removed after the old site was set up.
 *
 * The demo posts are articles from American evangelical / Reformed Baptist
 * publishers. The proof is not a matter of taste:
 *
 *  - `church-urges-government-to-address-poverty` is titled "'The Gospel
 *    According to Satan' Releases Today" and its body is a book announcement
 *    for "Midwestern Seminary's author in residence, Jared C. Wilson" from
 *    "Thomas Nelson". A Catholic archdiocese did not write a Baptist
 *    seminary's book promotion.
 *  - The slugs and the titles disagree, which is the signature of a demo
 *    import: the theme was installed with placeholder slugs
 *    ("objectively-create-quality-bandwidth", "join-us-as-we-celebrate-
 *    baptism") and the demo content then overwrote the titles.
 *  - They are all dated 2019-11-14 and 2020-01-24 — two batches, minutes
 *    apart, well before any real content on the site (2022 onwards).
 *  - `join-us-as-we-celebrate-baptism` teaches Keswick theology, which is not
 *    Catholic doctrine.
 *
 * So they are somebody else's copyrighted writing, doctrinally wrong for this
 * diocese, and were only ever placeholder furniture. They should not be
 * republished on the new site.
 *
 * Four more posts have no content at all: an empty "welcome" post whose title
 * is its own slug, and three deanery posts that are titles with empty bodies.
 *
 * Why unpublish rather than delete
 * --------------------------------
 * Deleting would throw away the record of what the old site carried, and the
 * decision is an editorial one that the archdiocese should be able to reverse.
 * Each post stays in the admin panel as a draft with a note explaining why,
 * so an editor can read it and either restore or delete it deliberately.
 *
 * The old URLs are handled separately — see redirects.overrides.ts, which
 * sends them to /news instead of to a page that would now 404.
 *
 * Run with:  npm run posts:quarantine
 *            POSTS_QUARANTINE_DRY=1 npm run posts:quarantine
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY = process.env.POSTS_QUARANTINE_DRY === '1'

/** slug -> why it is being unpublished. The note is stored on the record. */
const QUARANTINE: Record<string, string> = {
  'church-urges-government-to-address-poverty':
    'Not the archdiocese’s content. The body is a book announcement for Jared C. Wilson’s "The Gospel According to Satan" (Thomas Nelson / Midwestern Seminary) — WordPress theme demo content. The slug and title do not even match, which is how the demo import left them. Unpublished rather than deleted so the archdiocese can decide.',
  'objectively-create-quality-bandwidth':
    'Not the archdiocese’s content. WordPress theme demo content — the slug is the theme’s placeholder ("objectively create quality bandwidth") and the title is an unrelated evangelical blog article. Unpublished rather than deleted so the archdiocese can decide.',
  'join-us-as-we-celebrate-baptism':
    'Not the archdiocese’s content. WordPress theme demo content: the slug is a placeholder and the article teaches Keswick theology, which is not Catholic doctrine. Unpublished rather than deleted so the archdiocese can decide.',
  'the-dog-likeness-of-christ':
    'Not the archdiocese’s content. One of six WordPress theme demo articles dated 2019–2020, before any real content on the old site. Unpublished rather than deleted so the archdiocese can decide.',
  '7-ways-to-protect-and-pass-on-the-gospel':
    'Not the archdiocese’s content. One of six WordPress theme demo articles dated 2019–2020, before any real content on the old site. Unpublished rather than deleted so the archdiocese can decide.',
  'is-there-forgiveness-for-a-seminary-student':
    'Not the archdiocese’s content. One of six WordPress theme demo articles dated 2019–2020, before any real content on the old site. Unpublished rather than deleted so the archdiocese can decide.',

  'welcome-to-archdiocese-of-mylapore':
    'Empty post: it has no body, and its title is its own slug. Nothing to publish. Unpublished until the archdiocese supplies a real welcome message.',
  'deanery-of-our-lady-of-lourdes':
    'Empty post: a title with no body. The deaneries now have their own records under Deaneries. Unpublished until there is content to show.',
  'deanery-of-the-sacred-heart-of-jesus':
    'Empty post: a title with no body. The deaneries now have their own records under Deaneries. Unpublished until there is content to show.',
  'deanery-of-st-john-the-baptist':
    'Empty post: a title with no body. The deaneries now have their own records under Deaneries. Unpublished until there is content to show.',
}

const main = async () => {
  const payload = await getPayload({ config })

  const all = await payload.find({
    collection: 'posts',
    limit: 500,
    depth: 0,
    // Drafts too, so re-running the script is harmless.
    draft: true,
  })

  let unpublished = 0
  let alreadyDraft = 0
  const missing: string[] = []

  for (const slug of Object.keys(QUARANTINE)) {
    const post = all.docs.find((doc) => doc.slug === slug)

    if (!post) {
      missing.push(slug)
      continue
    }

    if (post._status === 'draft') {
      alreadyDraft++
      continue
    }

    if (!DRY) {
      await payload.update({
        collection: 'posts',
        id: post.id,
        data: {
          _status: 'draft',
          legacy: {
            ...(post.legacy ?? {}),
            needsReview: true,
            reviewNote: QUARANTINE[slug],
          },
        } as never,
        context: { disableRevalidate: true },
      })
    }

    unpublished++
    console.log(`  draft: ${slug}`)
  }

  console.log(`\n  unpublished: ${unpublished}   already draft: ${alreadyDraft}`)
  if (missing.length) {
    console.log(`  not found (already deleted?): ${missing.join(', ')}`)
  }

  const remaining = all.docs.filter(
    (doc) => !QUARANTINE[doc.slug] && doc._status === 'published',
  )
  console.log(`\n  ${remaining.length} news posts remain published:`)
  for (const doc of remaining) console.log(`    ${doc.slug}`)

  if (DRY) console.log('\nDry run. Re-run without POSTS_QUARANTINE_DRY=1 to apply.')
  process.exit(0)
}

await main()
