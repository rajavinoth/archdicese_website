import type { CollectionConfig } from 'payload'
import { isEditor, isAdmin } from '@/access/roles'

/**
 * Messages sent from the public contact form.
 *
 * Submissions are stored in the database rather than emailed, because Payload
 * has no email adapter configured yet — it would only write them to the server
 * console, and they would be lost. Storing them means nothing is dropped, and
 * an `afterChange` hook can send a notification later once SMTP exists (see
 * "Going to production" in the README).
 *
 * Access is deliberately asymmetric: anyone may create, only staff may read.
 */
export const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  labels: { singular: 'Message', plural: 'Messages' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'name', 'email', 'status', 'createdAt'],
    group: 'Administration',
    description: 'Messages sent through the contact form on the website.',
  },
  access: {
    // The public form posts here; the server action is the only caller.
    create: () => true,
    // Messages from the public are not public.
    read: isEditor,
    update: isEditor,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      admin: { position: 'sidebar' },
      options: [
        { label: 'New', value: 'new' },
        { label: 'In progress', value: 'inProgress' },
        { label: 'Answered', value: 'answered' },
        { label: 'Spam', value: 'spam' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'email', type: 'email', required: true, admin: { width: '50%' } },
      ],
    },
    { name: 'phone', type: 'text' },
    {
      name: 'topic',
      type: 'select',
      options: [
        { label: 'General enquiry', value: 'general' },
        { label: 'Sacrament certificate (baptism, marriage)', value: 'certificate' },
        { label: 'Mass intention or booking', value: 'mass' },
        { label: 'Parish matter', value: 'parish' },
        { label: 'Website correction', value: 'website' },
      ],
    },
    { name: 'subject', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes. Not visible to the sender.',
      },
    },
  ],
  timestamps: true,
}
