import { sqliteAdapter } from '@payloadcms/db-sqlite'

/**
 * Database adapter, isolated so the rest of the app never cares which engine
 * is behind it.
 *
 * Development uses SQLite: a single file, no server to install.
 *
 * For production, install @payloadcms/db-postgres and swap the export for:
 *
 *   import { postgresAdapter } from '@payloadcms/db-postgres'
 *   export const db = postgresAdapter({
 *     pool: { connectionString: process.env.DATABASE_URI! },
 *   })
 *
 * Nothing else in the codebase needs to change.
 */
export const db = sqliteAdapter({
  client: {
    url: process.env.DATABASE_URI || 'file:./diocese.db',
  },
  // Keeps the local schema in step with the collections during development.
  push: true,
})
