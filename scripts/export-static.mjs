/**
 * Builds the site as plain files, for publishing to GitHub Pages.
 *
 * What this is for
 * ----------------
 * Showing the look and feel of the site to people who need to approve it,
 * without a server, a database or a bill. It is **not** the site: there is no
 * admin panel, no search, and the contact form cannot send anything, because
 * all three need something running. Everything a visitor reads is here.
 *
 * Why a script rather than a flag
 * ------------------------------
 * Four things have to happen around the build, and three of them have to be
 * undone afterwards:
 *
 *  1. The Payload routes — the admin panel and the API — are moved out of the
 *     way. `output: 'export'` refuses to build a route handler, and Payload's
 *     API is nothing but route handlers.
 *  2. The search page is moved out of the way too. It reads the query string
 *     on the server, which is exactly what a static file cannot do.
 *  3. `.next` is deleted first. Next.js keeps a generated file listing every
 *     route, and if it still names the routes that were just moved aside, the
 *     type check fails on modules that are no longer there.
 *  4. Afterwards the uploads are copied to where their addresses say they are,
 *     and those addresses are corrected if the site is served from a
 *     subdirectory.
 *
 * Run with:
 *   npm run export:static
 *   NEXT_PUBLIC_BASE_PATH=/diocese-website npm run export:static
 *
 * The result is in `out/`.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const STASH = '.export-stash'

/** Moved aside for the duration of the build, and put back afterwards. */
const SERVER_ONLY = [
  { from: 'src/app/(payload)', to: `${STASH}/payload`, why: 'the admin panel and the API' },
  {
    from: 'src/app/(frontend)/[locale]/search',
    to: `${STASH}/search`,
    why: 'search reads the query string on the server',
  },
]

/**
 * Payload serves uploads from these addresses. They are not files Next.js
 * knows about — they come out of the database — so they are copied into the
 * export by hand, at the path the pages ask for.
 */
const UPLOADS = [
  { from: 'media', to: 'api/media/file' },
  { from: 'documents', to: 'api/documents/file' },
]

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')

const exists = async (target) => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const restore = async () => {
  for (const entry of SERVER_ONLY) {
    if (await exists(entry.to)) {
      await fs.mkdir(path.dirname(entry.from), { recursive: true })
      await fs.rm(entry.from, { recursive: true, force: true })
      await fs.rename(entry.to, entry.from)
    }
  }
  await fs.rm(STASH, { recursive: true, force: true })
}

/** Every file under a directory, recursively. */
const walk = async (dir, found = []) => {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, found)
    else found.push(full)
  }
  return found
}

const main = async () => {
  console.log('  clearing .next so the route list is rebuilt from scratch')
  await fs.rm('.next', { recursive: true, force: true })
  await fs.rm('out', { recursive: true, force: true })
  await fs.rm(STASH, { recursive: true, force: true })
  await fs.mkdir(STASH, { recursive: true })

  for (const entry of SERVER_ONLY) {
    if (!(await exists(entry.from))) continue
    console.log(`  setting aside ${entry.from} — ${entry.why}`)
    await fs.rename(entry.from, entry.to)
  }

  try {
    console.log('\n  building\n')
    execSync('npm run build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        STATIC_EXPORT: '1',
        // The demo database: no personal data, no accounts.
        DATABASE_URI: process.env.DATABASE_URI || 'file:./demo-data/diocese.db',
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'static-export-placeholder',
        DEMO_NOINDEX: process.env.DEMO_NOINDEX || '1',
      },
    })
  } finally {
    // Whether the build worked or not, the project goes back as it was. A
    // failed export must not leave the repository missing its admin panel.
    console.log('\n  putting the server-only routes back')
    await restore()
  }

  // ---- The uploads -------------------------------------------------------
  for (const upload of UPLOADS) {
    const target = path.join('out', upload.to)
    await fs.mkdir(target, { recursive: true })
    await fs.cp(upload.from, target, { recursive: true })
    const count = (await fs.readdir(upload.from)).length
    console.log(`  copied ${count} files: ${upload.from} -> out/${upload.to}`)
  }

  // ---- English belongs at the root ---------------------------------------
  /**
   * English lives at `/clergy` on this site and Tamil at `/ta/clergy`, which
   * `src/proxy.ts` arranges by rewriting `/clergy` to `/en/clergy` behind the
   * scenes. A static host runs no proxy, so the export writes `out/en/clergy`
   * while every link on every page still says `/clergy` — the whole English
   * site, 404ing.
   *
   * So English is lifted out of `en/` and up to the root, which is where its
   * own links, the sitemap and the hreflang tags all say it is. Tamil already
   * has the `/ta` prefix in both the export and the links, and is left alone.
   */
  const lifted = []

  for (const name of ['en.html', 'en.txt']) {
    const from = path.join('out', name)
    if (await exists(from)) {
      const to = path.join('out', name.replace(/^en/, 'index'))
      await fs.rename(from, to)
      lifted.push(name)
    }
  }

  if (await exists('out/en')) {
    for (const entry of await fs.readdir('out/en')) {
      const to = path.join('out', entry)
      await fs.rm(to, { recursive: true, force: true })
      await fs.rename(path.join('out/en', entry), to)
      lifted.push(entry)
    }
    await fs.rm('out/en', { recursive: true, force: true })
  }

  console.log(`  moved ${lifted.length} English entries from out/en/ up to out/`)

  // ---- Addresses, if the site is served from a subdirectory ---------------
  /**
   * Next.js rewrites its own links for `basePath`, but the upload addresses
   * came out of the database and it has never seen them: a page served from
   * /repo/ would ask for /api/media/file/x.jpg and get the whole site's 404.
   * They are corrected here, after the build, which also catches the ones
   * inside migrated rich text.
   */
  if (basePath) {
    /**
     * Next.js prefixes most of this itself. These are the ones it misses:
     *
     *   /brand/  — the archdiocesan seal, in the header and footer of every
     *              page. It is referenced by a literal path rather than an
     *              import, so nothing rewrites it, and the site would lose its
     *              logo everywhere.
     *   /api/    — the uploads, whose addresses came out of the database.
     *              Next.js does prefix the ones it renders through `next/image`
     *              but not the ones inside migrated rich text.
     *
     * Each pattern begins with the quote that opens the attribute, so a path
     * that has already been prefixed cannot match a second time: after the
     * rewrite the quote is followed by the base path, not by `/brand/`.
     */
    const PREFIXES = ['/brand/', '/api/media/file/', '/api/documents/file/']

    const files = (await walk('out')).filter((file) =>
      ['.html', '.js', '.json', '.txt', '.xml'].includes(path.extname(file)),
    )

    let changed = 0

    for (const file of files) {
      const before = await fs.readFile(file, 'utf8')
      let after = before

      for (const prefix of PREFIXES) {
        after = after
          .replaceAll(`"${prefix}`, `"${basePath}${prefix}`)
          .replaceAll(`'${prefix}`, `'${basePath}${prefix}`)
          .replaceAll(`(${prefix}`, `(${basePath}${prefix}`)
      }

      if (after !== before) {
        await fs.writeFile(file, after)
        changed++
      }
    }

    console.log(`  rewrote asset addresses for ${basePath} in ${changed} files`)
  }

  // GitHub Pages runs Jekyll over anything it serves unless told not to, and
  // Jekyll ignores directories beginning with an underscore — which is where
  // Next.js puts every one of its assets.
  await fs.writeFile('out/.nojekyll', '')
  console.log('  wrote out/.nojekyll')

  const all = await walk('out')
  console.log(`\n  done: ${all.length} files in out/`)
}

main().catch(async (error) => {
  await restore()
  console.error(error)
  process.exit(1)
})
