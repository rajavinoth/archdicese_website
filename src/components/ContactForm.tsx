'use client'

import { useActionState, useEffect, useRef } from 'react'

import { submitContact, type ContactState } from '@/app/(frontend)/[locale]/contact/actions'

const initial: ContactState = { status: 'idle' }

const TOPIC_KEYS = ['general', 'certificate', 'mass', 'parish', 'website'] as const

export type ContactLabels = {
  name: string
  email: string
  phone: string
  optional: string
  topic: string
  subject: string
  message: string
  send: string
  sending: string
  thanks: string
  thanksBody: string
  privacyNote: string
  topics: Record<(typeof TOPIC_KEYS)[number], string>
}

/**
 * Uses a server action with `useActionState`, so the form still submits and
 * validates if JavaScript has not loaded — which matters on the slow mobile
 * connections a lot of this site's visitors are on.
 */
export function ContactForm({
  labels,
  locale,
  phoneHref,
  phoneLabel,
}: {
  labels: ContactLabels
  locale: string
  phoneHref: string
  phoneLabel: string
}) {
  const [state, formAction, pending] = useActionState(submitContact, initial)

  /**
   * Stamped on mount and checked by the action; see the spam notes there.
   * Written straight to the input rather than held in state: the value must
   * come from the browser (the server would render a different timestamp and
   * cause a hydration mismatch), and a DOM write avoids re-rendering.
   */
  const startedAtRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (startedAtRef.current) startedAtRef.current.value = String(Date.now())
  }, [])

  if (state.status === 'success') {
    return (
      <div
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-6"
        role="status"
      >
        <h3 className="font-medium text-emerald-900">{labels.thanks}</h3>
        <p className="mt-2 text-sm text-emerald-800">
          {labels.thanksBody}{' '}
          <a href={phoneHref} className="underline">
            {phoneLabel}
          </a>
          .
        </p>
      </div>
    )
  }

  const error = (field: string) => state.errors?.[field]
  const value = (field: string) => state.values?.[field] ?? ''

  const fieldClass = (field: string) =>
    `mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 ${
      error(field) ? 'border-red-400' : 'border-slate-300'
    }`

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.message}
        </p>
      )}

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAtRef} type="hidden" name="startedAt" defaultValue="" />
      {/* So the server action can answer in the same language. */}
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            {labels.name} <span aria-hidden="true">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={value('name')}
            aria-invalid={Boolean(error('name'))}
            aria-describedby={error('name') ? 'name-error' : undefined}
            className={fieldClass('name')}
          />
          {error('name') && (
            <p id="name-error" className="mt-1 text-xs text-red-700">
              {error('name')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            {labels.email} <span aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={value('email')}
            aria-invalid={Boolean(error('email'))}
            aria-describedby={error('email') ? 'email-error' : undefined}
            className={fieldClass('email')}
          />
          {error('email') && (
            <p id="email-error" className="mt-1 text-xs text-red-700">
              {error('email')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
            {labels.phone} <span className="text-slate-400">{labels.optional}</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={value('phone')}
            className={fieldClass('phone')}
          />
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-slate-700">
            {labels.topic}
          </label>
          <select
            id="topic"
            name="topic"
            defaultValue={value('topic') || 'general'}
            className={fieldClass('topic')}
          >
            {TOPIC_KEYS.map((key) => (
              <option key={key} value={key}>
                {labels.topics[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
          {labels.subject} <span aria-hidden="true">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          defaultValue={value('subject')}
          aria-invalid={Boolean(error('subject'))}
          aria-describedby={error('subject') ? 'subject-error' : undefined}
          className={fieldClass('subject')}
        />
        {error('subject') && (
          <p id="subject-error" className="mt-1 text-xs text-red-700">
            {error('subject')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-700">
          {labels.message} <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          defaultValue={value('message')}
          aria-invalid={Boolean(error('message'))}
          aria-describedby={error('message') ? 'message-error' : undefined}
          className={fieldClass('message')}
        />
        {error('message') && (
          <p id="message-error" className="mt-1 text-xs text-red-700">
            {error('message')}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? labels.sending : labels.send}
      </button>

      <p className="text-xs text-slate-500">
        {labels.privacyNote}
      </p>
    </form>
  )
}
