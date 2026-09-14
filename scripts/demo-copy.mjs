/**
 * Copies the working database to `demo-data/diocese.db`, ready for
 * `scripts/demo-prepare.ts` to empty the personal data out of the copy.
 *
 * `VACUUM INTO` rather than a file copy. SQLite keeps recent writes in a
 * separate write-ahead log, so copying `diocese.db` on its own can produce a
 * file that is missing whatever was written most recently — including, if the
 * dev server happens to be running, a change made a second ago. `VACUUM INTO`
 * asks SQLite itself for a complete, consistent copy in one file, and compacts
 * it on the way out.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { createClient } from '@libsql/client'

const SOURCE = process.env.DATABASE_URI?.replace(/^file:/, '') || './diocese.db'
const TARGET = 'demo-data/diocese.db'

const main = async () => {
  await fs.mkdir(path.dirname(TARGET), { recursive: true })

  // VACUUM INTO refuses to overwrite, which is the behaviour we want from it
  // everywhere except here.
  await fs.rm(TARGET, { force: true })

  const client = createClient({ url: `file:${SOURCE}` })
  await client.execute(`VACUUM INTO '${TARGET}'`)
  client.close()

  const source = await fs.stat(SOURCE)
  const target = await fs.stat(TARGET)

  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
  console.log(`  ${SOURCE} (${mb(source.size)})  ->  ${TARGET} (${mb(target.size)})`)
}

await main()
