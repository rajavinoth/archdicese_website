'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { DEFAULT_LOCALE, getDictionary, isLocale } from '@/lib/i18n'

export type ContactState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** Field name -> error, so the form can mark the offending inputs. */
  errors?: Record<string, string>
  /** Echoed back so a failed submission does not lose what was typed. */
  values?: Record<string, string>
}

const MAX = {
  name: 120,
  email: 200,
  phone: 40,
  subject: 200,
  message: 4000,
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const TOPICS = new Set(['general', 'certificate', 'mass', 'parish', 'website'])

export async function submitContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const read = (key: string) => String(formData.get(key) ?? '').trim()

  // The form posts its locale so validation messages come back in-language.
  const rawLocale = read('locale')
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale).contact.errors

  const values = {
    name: read('name'),
    email: read('email'),
    phone: read('phone'),
    topic: read('topic'),
    subject: read('subject'),
    message: read('message'),
  }

  /**
   * Two cheap spam checks. Neither is a substitute for a captcha or edge rate
   * limiting, which a public form on a live site should also have — see the
   * README. They are here so the form is not completely open on day one.
   *
   * 1. A honeypot field that is hidden from people but filled in by bots.
   * 2. A minimum time between the page rendering and the post.
   */
  if (read('website')) {
    // Silently accept so the bot does not learn anything, but store nothing.
    return { status: 'success' }
  }

  const startedAt = Number(read('startedAt'))
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 2500) {
    return {
      status: 'error',
      message: t.tooFast,
      values,
    }
  }

  const errors: Record<string, string> = {}

  if (!values.name) errors.name = t.name
  if (!values.email) errors.email = t.email
  else if (!EMAIL.test(values.email)) errors.email = t.emailInvalid
  if (!values.subject) errors.subject = t.subject
  if (!values.message) errors.message = t.message

  for (const [field, limit] of Object.entries(MAX)) {
    const value = values[field as keyof typeof values]
    if (value && value.length > limit) {
      errors[field] = `Please keep this under ${limit} characters.`
    }
  }

  if (Object.keys(errors).length > 0) {
    return { status: 'error', errors, values }
  }

  try {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'contact-submissions',
      data: {
        status: 'new',
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        topic: TOPICS.has(values.topic) ? values.topic : 'general',
        subject: values.subject,
        message: values.message,
      } as never,
      // Nothing on the public site renders these, so no page needs rebuilding.
      context: { disableRevalidate: true },
      overrideAccess: true,
    })

    return { status: 'success' }
  } catch (error) {
    // Log the real reason server-side; show the sender something useful.
    console.error('Contact form submission failed:', error)

    return {
      status: 'error',
      message: t.failed,
      values,
    }
  }
}
