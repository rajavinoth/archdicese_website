import path from 'path'
import { fileURLToPath } from 'url'

import { buildConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { db } from './db'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Deaneries } from './collections/Deaneries'
import { Parishes } from './collections/Parishes'
import { Clergy } from './collections/Clergy'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Categories } from './collections/Categories'
import { Events } from './collections/Events'
import { ContactSubmissions } from './collections/ContactSubmissions'
import { Verses } from './collections/Verses'
import { Documents } from './collections/Documents'
import { Videos } from './collections/Videos'
import { Albums } from './collections/Albums'
import { Homepage } from './globals/Homepage'
import { ArchbishopPage } from './globals/ArchbishopPage'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ' — Archdiocese of Madras-Mylapore',
    },
  },

  collections: [
    // Archdiocese
    Deaneries,
    Parishes,
    Clergy,
    // Content
    Pages,
    Posts,
    Events,
    Categories,
    Verses,
    Documents,
    Videos,
    Albums,
    // Administration
    ContactSubmissions,
    Media,
    Users,
  ],

  globals: [Homepage, ArchbishopPage],

  /**
   * English and Tamil.
   *
   * `fallback: true` is what makes a partial translation usable: a Tamil page
   * with no Tamil value for a field falls back to the English one, so the site
   * is never blank while translation is in progress.
   *
   * Slugs are deliberately NOT localized -- URLs stay the same in both
   * languages, which keeps the 270 redirects from the old site valid and means
   * one page has one canonical identity.
   */
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'தமிழ் (Tamil)', code: 'ta' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },

  editor: lexicalEditor(),

  // The database adapter lives in src/db.ts so switching SQLite -> Postgres
  // for production is a one-file change.
  db,

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  sharp,

  upload: {
    limits: { fileSize: 10_000_000 }, // 10 MB
  },

  plugins: [],
})
