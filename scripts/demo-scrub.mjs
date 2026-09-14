/**
 * Empties the personal data that `demo-prepare` cannot reach: version history.
 *
 * Clearing a field through Payload clears the *current* record. It does not
 * touch the versions behind it, and `Clergy` has `versions: { drafts: true }`,
 * so every edit ever made to a priest's record is still there in `_clergy_v`.
 * On this database that is **419 rows still holding an email address, a
 * telephone number and a home address, and 410 holding a date of birth** —
 * after the visible records had been emptied and looked clean.
 *
 * Version rows are not reachable through the Local API, so this goes through
 * SQL. It nulls the columns rather than deleting the rows, so the admin panel's
 * version history still works and simply has nothing personal in it.
 *
 * Two further checks run at the end and fail the script rather than warn,
 * because the whole point of this file is to be the thing that does not let
 * personal data through:
 *
 *   - no account may remain (a committed password hash can be guessed at
 *     offline, without a rate limit)
 *   - no table anywhere may still hold a value in one of these columns
 *
 * Run as part of:  npm run demo:prepare
 */

import { createClient } from '@libsql/client'

const TARGET = 'demo-data/diocese.db'

/**
 * Columns that carry personal data, in the two spellings the schema uses: a
 * collection's own table (`email`) and its version table (`version_email`).
 * Parish telephone and email are deliberately absent — those are parish office
 * details, published on the old site and on this one.
 */
const PERSONAL = ['email', 'phone', 'residence_address', 'date_of_birth']

const personalColumnsOf = (columns) =>
  columns.filter((column) =>
    PERSONAL.some((name) => column === name || column === `version_${name}`),
  )

const main = async () => {
  const client = createClient({ url: `file:${TARGET}` })

  const tables = await client.execute(
    "select name from sqlite_master where type = 'table'",
  )

  let cleared = 0

  for (const { name } of tables.rows) {
    // Only the clergy tables. A parish's telephone number is the parish
    // office's and stays; naming the tables explicitly stops this script
    // quietly emptying a column someone adds later that happens to match.
    if (name !== 'clergy' && name !== '_clergy_v') continue

    const sample = await client.execute(`select * from "${name}" limit 1`)
    const columns = personalColumnsOf(sample.columns)
    if (columns.length === 0) continue

    const assignments = columns.map((column) => `"${column}" = null`).join(', ')
    const test = columns.map((column) => `"${column}" is not null`).join(' or ')

    const before = await client.execute(
      `select count(*) as n from "${name}" where ${test}`,
    )

    await client.execute(`update "${name}" set ${assignments}`)

    const rows = Number(before.rows[0].n)
    cleared += rows
    console.log(`  ${name}: ${rows} rows cleared (${columns.join(', ')})`)
  }

  // ---- Verify, and fail if anything is left -------------------------------
  const remaining = []

  for (const { name } of tables.rows) {
    if (name === 'parishes' || name === '_parishes_v') continue

    const sample = await client.execute(`select * from "${name}" limit 1`)
    const columns = personalColumnsOf(sample.columns)
    if (columns.length === 0) continue

    const test = columns.map((column) => `"${column}" is not null`).join(' or ')
    const count = await client.execute(
      `select count(*) as n from "${name}" where ${test}`,
    )

    if (Number(count.rows[0].n) > 0) {
      remaining.push(`${name}: ${count.rows[0].n} rows`)
    }
  }

  const users = await client.execute('select count(*) as n from users')
  const accounts = Number(users.rows[0].n)

  client.close()

  console.log(`\n  personal values cleared: ${cleared}`)
  console.log(`  accounts in the demo database: ${accounts}`)

  if (remaining.length > 0) {
    console.error('\n  STOPPING: personal data is still present in')
    for (const line of remaining) console.error(`    ${line}`)
    console.error('\n  This database must not be committed or deployed.\n')
    process.exit(1)
  }

  if (accounts > 0) {
    console.error('\n  STOPPING: the demo database still contains an account.')
    console.error('  The administrator is meant to be created by the container')
    console.error('  at start-up, so that no password hash is ever committed.\n')
    process.exit(1)
  }

  console.log('\n  Clean. Safe to commit and deploy.')
}

await main()
