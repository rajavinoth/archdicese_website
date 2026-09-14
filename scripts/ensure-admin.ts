/**
 * Creates the administrator account when the container starts, if there is not
 * one already.
 *
 * The demo database is committed with **no accounts at all**, deliberately: a
 * password hash inside a committed file is published to anyone who can read
 * the repository, and guessing at a hash offline has no rate limit to slow it
 * down. The password therefore lives only in the host's environment.
 *
 * That leaves one hazard, and it is the reason this script exits non-zero
 * rather than shrugging. Payload offers a "create the first user" screen when
 * a project has no accounts — which is exactly right on a laptop and exactly
 * wrong on a public address, where the first stranger to find /admin becomes
 * the administrator of a real archdiocese's website. So: no credentials, no
 * start. A container that will not boot is a visible failure; an open
 * sign-up page is an invisible one.
 *
 * Run by the container's entrypoint, before the server starts.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const email = process.env.ADMIN_EMAIL?.trim()
const password = process.env.ADMIN_PASSWORD?.trim()

const fail = (message: string): never => {
  console.error(`\n  ${message}\n`)
  console.error('  Set ADMIN_EMAIL and ADMIN_PASSWORD on the service and redeploy.')
  console.error('  Without them Payload would offer its "create the first user"')
  console.error('  screen to whoever opens /admin first.\n')
  process.exit(1)
}

const main = async () => {
  const payload = await getPayload({ config })

  const existing = await payload.count({ collection: 'users' })

  if (existing.totalDocs > 0) {
    console.log(`  ${existing.totalDocs} account(s) already exist — leaving them alone.`)
    process.exit(0)
  }

  if (!email || !password) {
    fail('There are no accounts, and ADMIN_EMAIL / ADMIN_PASSWORD are not set.')
  }

  if (password!.length < 12) {
    fail('ADMIN_PASSWORD is shorter than 12 characters.')
  }

  await payload.create({
    collection: 'users',
    data: {
      name: 'Administrator',
      email: email!,
      password: password!,
      roles: ['admin'],
    } as never,
  })

  console.log(`  created the administrator account: ${email}`)
  process.exit(0)
}

await main()
