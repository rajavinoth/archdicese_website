import path from 'node:path'

/**
 * Where the site keeps the things it writes: the database file and the two
 * upload directories.
 *
 * In development these sit in the project, which is what every script and the
 * dev server already expect, so `DATA_DIR` is unset and nothing changes.
 *
 * In a container they have to live somewhere that survives a restart. A
 * container's own filesystem does not: it is rebuilt from the image every
 * deploy, so an issue uploaded through the admin panel on Monday is gone on
 * Tuesday. Pointing `DATA_DIR` at a mounted disk moves all three together —
 * they have to move together, because a database row that names a file is
 * worthless if the file went somewhere else.
 *
 * `DATABASE_URI` stays separate (see src/db.ts) because it is a connection
 * string, not a path, and will be a Postgres URL before this site goes live.
 */
export const DATA_DIR = process.env.DATA_DIR?.trim() || process.cwd()

/** Images. Payload would default this to `media` beside the project root. */
export const MEDIA_DIR = path.join(DATA_DIR, 'media')

/** PDFs and other downloads: the forms, and every newsletter issue. */
export const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
