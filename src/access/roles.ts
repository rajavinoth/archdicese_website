import type { Access, FieldAccess } from 'payload'

/**
 * Roles used across the site.
 *
 *  admin        - diocesan webmaster / curia staff. Full control.
 *  editor       - communications team. Can publish news, events, documents.
 *  parishPriest - can edit only their own parish record (timings, news, photos).
 */
export type Role = 'admin' | 'editor' | 'parishPriest'

const rolesOf = (user: unknown): Role[] => {
  const roles = (user as { roles?: Role[] } | null)?.roles
  return Array.isArray(roles) ? roles : []
}

export const hasRole =
  (...allowed: Role[]): Access =>
  ({ req }) =>
    rolesOf(req.user).some((role) => allowed.includes(role))

export const hasRoleField =
  (...allowed: Role[]): FieldAccess =>
  ({ req }) =>
    rolesOf(req.user).some((role) => allowed.includes(role))

export const isAdmin: Access = hasRole('admin')
export const isEditor: Access = hasRole('admin', 'editor')

/**
 * Anyone may read published content; staff may read drafts too.
 *
 * IMPORTANT: this only runs if the caller asks for it. Payload's Local API
 * (`payload.find` inside a page or a script) **skips access control by
 * default**, so every query made by the public site must pass
 * `overrideAccess: false`. Without it the site happily serves drafts: ten
 * unpublished news posts were still rendering on /news until this was fixed.
 *
 * Scripts under scripts/ deliberately do not pass it — they are meant to see
 * everything.
 */
export const publishedOrStaff: Access = ({ req }) => {
  if (rolesOf(req.user).length > 0) return true
  return { _status: { equals: 'published' } }
}

/**
 * Parish priests may only write the parish they are assigned to.
 * Admins and editors may write any.
 */
export const canEditOwnParish: Access = ({ req }) => {
  const roles = rolesOf(req.user)
  if (roles.includes('admin') || roles.includes('editor')) return true
  if (!roles.includes('parishPriest')) return false

  const parish = (req.user as { parish?: string | { id: string } } | null)?.parish
  const parishId = typeof parish === 'object' && parish !== null ? parish.id : parish
  if (!parishId) return false

  return { id: { equals: parishId } }
}

/**
 * Field-level read guard for clergy contact details.
 *
 * Hiding them in the page template is not enough: `clergy` is publicly
 * readable, so `/api/clergy` would hand out every priest's mobile number and
 * email to anyone who asked. This makes the fields themselves unreadable
 * unless the priest has opted in, or the requester is signed-in staff.
 */
export const contactVisible: FieldAccess = ({ req, doc }) => {
  if (rolesOf(req.user).length > 0) return true
  return Boolean((doc as { contactPublic?: boolean } | undefined)?.contactPublic)
}
