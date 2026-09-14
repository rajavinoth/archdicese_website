import { revalidatePath } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

/**
 * Static pages need to be told when their content has changed.
 *
 * Pages like /clergy are prerendered at build time, which is what makes them
 * fast. The trade-off is that editing a record in the admin does not, by
 * itself, change what visitors see -- Next.js keeps serving the cached HTML.
 * These hooks close that gap: when a document is saved or deleted, we mark the
 * affected URLs stale so Next.js rebuilds them on the next request.
 *
 * Without this, an editor saves a change, reloads the site, sees nothing, and
 * concludes the site is broken.
 */

/** Given a document, which URLs does it appear on? */
type PathsFor<T> = (doc: T) => string[]

/**
 * revalidatePath only works inside a Next.js request. Payload hooks also run
 * from the CLI (`npm run seed`) and from scripts, where it throws -- so every
 * call is guarded rather than allowed to fail a legitimate write.
 */
const revalidate = (paths: Set<string>, req: PayloadRequest) => {
  for (const path of paths) {
    try {
      revalidatePath(path)
      req.payload.logger.info(`Revalidated ${path}`)
    } catch {
      // Outside a request context (seed script, migration). The write itself
      // is fine; there is simply no page cache to invalidate here.
      req.payload.logger.debug(`Skipped revalidating ${path} (no request context)`)
    }
  }
}

/**
 * Collect the URLs to refresh. `previousDoc` matters: if an editor changes a
 * slug, the OLD url has to be revalidated too or it will keep serving the
 * stale page.
 */
const pathsToRefresh = <T>(
  getPaths: PathsFor<T>,
  doc: T,
  previousDoc?: T,
): Set<string> => {
  const paths = new Set(getPaths(doc))
  if (previousDoc) {
    for (const path of getPaths(previousDoc)) paths.add(path)
  }
  return paths
}

export const revalidateAfterChange =
  <T>(getPaths: PathsFor<T>): CollectionAfterChangeHook =>
  ({ doc, previousDoc, req, context }) => {
    // Lets bulk imports and the seed script opt out entirely.
    if (context?.disableRevalidate) return doc

    revalidate(pathsToRefresh(getPaths, doc as T, previousDoc as T | undefined), req)
    return doc
  }

export const revalidateAfterDelete =
  <T>(getPaths: PathsFor<T>): CollectionAfterDeleteHook =>
  ({ doc, req, context }) => {
    if (context?.disableRevalidate) return doc

    revalidate(pathsToRefresh(getPaths, doc as T), req)
    return doc
  }

/**
 * The same thing for a global. A global has no slug and no previous version to
 * compare, so the paths it affects are fixed and passed in directly.
 */
export const revalidateGlobalAfterChange =
  (paths: string[]): GlobalAfterChangeHook =>
  ({ doc, req, context }) => {
    if (context?.disableRevalidate) return doc

    revalidate(new Set(paths), req)
    return doc
  }

// ---- Which pages show which content -----------------------------------

type HasSlug = { slug?: string | null }

/** A priest appears on the homepage counts, the directory, and their own page. */
export const clergyPaths = (doc: HasSlug): string[] => [
  '/',
  '/clergy',
  ...(doc.slug ? [`/clergy/${doc.slug}`] : []),
]

/** A parish likewise, plus the finder. */
export const parishPaths = (doc: HasSlug): string[] => [
  '/',
  '/parishes',
  ...(doc.slug ? [`/parishes/${doc.slug}`] : []),
]

/**
 * A deanery is a filter option on both directories, and renaming one changes
 * the label shown on every parish and priest card -- so both lists go stale.
 */
export const deaneryPaths = (): string[] => ['/', '/clergy', '/parishes']
