import type { CollectionConfig } from 'payload'
import { hasRoleField, isAdmin } from '@/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'roles'],
    group: 'Administration',
  },
  auth: true,
  access: {
    // Only admins manage accounts; everyone signed in can read the user list
    // (needed so relationship dropdowns work for other editors).
    create: isAdmin,
    delete: isAdmin,
    update: ({ req }) => {
      const roles = (req.user as { roles?: string[] } | null)?.roles ?? []
      if (roles.includes('admin')) return true
      // Non-admins may edit only their own account.
      return req.user ? { id: { equals: req.user.id } } : false
    },
    read: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['editor'],
      // Only an admin can change what someone is allowed to do.
      access: {
        create: hasRoleField('admin'),
        update: hasRoleField('admin'),
      },
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Editor (communications)', value: 'editor' },
        { label: 'Parish Priest', value: 'parishPriest' },
      ],
    },
    {
      name: 'parish',
      type: 'relationship',
      relationTo: 'parishes',
      admin: {
        description: 'For parish priests: the parish this account may edit.',
        condition: (data) => data?.roles?.includes('parishPriest'),
      },
    },
  ],
}
