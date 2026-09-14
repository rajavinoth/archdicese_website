/**
 * Makes a database that is safe to put in a repository and on a public URL.
 *
 * Why this exists
 * ---------------
 * The working database holds real personal data. 46 of the 104 priests have an
 * email address, a personal telephone number and a home address on their
 * record, and 45 have a date of birth. **None of them is public**: every one
 * of those fields is gated behind the `contactPublic` checkbox and that
 * checkbox is off for all 104, so the website never shows them. The clergy
 * pages are correct.
 *
 * A database file is not a website, though. Committing `diocese.db` to a
 * repository — or handing it to a build service — publishes every row in it,
 * access control and all, because access control is applied when Payload reads
 * a row and there is no Payload between a git clone and a curious reader. That
 * is how a demo of a site that carefully hides 46 priests' home addresses ends
 * up publishing 46 priests' home addresses.
 *
 * So the demo runs on a copy with those fields emptied. Not hidden: emptied.
 *
 * What it removes
 * ---------------
 *   - every clergy email, telephone, home address and date of birth whose
 *     record is not marked `contactPublic`
 *   - every contact-form submission
 *   - every user account, including the seeded admin@example.com whose
 *     password is in this repository's own seed script
 *
 * No account is created in its place. A password hash in a committed database
 * is a password hash published to everyone who can clone the repository, and
 * guessing at it offline has no rate limit to stop it. The administrator is
 * created when the container starts, from environment variables held by the
 * host and never written down here — see scripts/ensure-admin.ts.
 *
 * Run with:  npm run demo:prepare
 *
 * It refuses to run against anything but the demo copy — see the guard below.
 * Getting that wrong would delete the curia's imported contact details from
 * the real database, and they came from a letter that took a while to parse.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * The guard. `npm run demo:prepare` copies the database first and points
 * DATABASE_URI at the copy; if that has not happened, this is pointed at the
 * working database and must not run.
 */
const uri = process.env.DATABASE_URI ?? ''

if (!uri.includes('demo-data')) {
  console.error('\n  Refusing to run.\n')
  console.error(`  DATABASE_URI is "${uri || '(unset)'}", which is not the demo copy.`)
  console.error('  This script empties personal data. Run it with `npm run demo:prepare`,')
  console.error('  which makes the copy first.\n')
  process.exit(1)
}

const main = async () => {
  const payload = await getPayload({ config })

  console.log(`  database: ${uri}\n`)

  // ---- Clergy contact details -------------------------------------------
  const priests = await payload.find({
    collection: 'clergy',
    limit: 1000,
    depth: 0,
    pagination: false,
    draft: true,
  })

  const toClear = priests.docs.filter(
    (priest) =>
      priest.contactPublic !== true &&
      (priest.email || priest.phone || priest.residenceAddress || priest.dateOfBirth),
  )

  for (const priest of toClear) {
    await payload.update({
      collection: 'clergy',
      id: priest.id,
      data: {
        email: null,
        phone: null,
        residenceAddress: null,
        dateOfBirth: null,
      } as never,
      context: { disableRevalidate: true },
    })
  }

  const stillPublic = priests.docs.filter((priest) => priest.contactPublic === true).length

  console.log(`  clergy records: ${priests.docs.length}`)
  console.log(`  personal details emptied: ${toClear.length}`)
  console.log(`  left alone because they are marked public: ${stillPublic}`)

  // ---- Contact-form submissions ------------------------------------------
  const submissions = await payload.find({
    collection: 'contact-submissions',
    limit: 1000,
    depth: 0,
    pagination: false,
  })

  for (const submission of submissions.docs) {
    await payload.delete({
      collection: 'contact-submissions',
      id: submission.id,
      context: { disableRevalidate: true },
    })
  }

  console.log(`  contact-form submissions deleted: ${submissions.docs.length}`)

  // ---- Accounts ----------------------------------------------------------
  /**
   * Every existing account goes and none is created in its place: the
   * container does that on first start, from the host's environment.
   */
  const users = await payload.find({ collection: 'users', limit: 100, depth: 0 })

  for (const user of users.docs) {
    await payload.delete({ collection: 'users', id: user.id })
  }

  console.log(`  accounts removed: ${users.docs.length} (none created — see ensure-admin)`)

  // ---- What is left, stated plainly --------------------------------------
  console.log('\n  Still in this database, and correct to be:')
  console.log('    - the parish and clergy directory as the public site shows it')
  console.log('    - the sample mass timings, which the site labels as invented')
  console.log('    - the archdiocesan office address and phone, which the old')
  console.log('      site published on its own contact page')

  process.exit(0)
}

await main()
