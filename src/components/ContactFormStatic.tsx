import type { ContactLabels } from '@/components/ContactForm'
import { DEFAULT_LOCALE, getDictionary, isLocale } from '@/lib/i18n'

/**
 * The contact form, as it appears on the static demo: not at all.
 *
 * The real form submits through a server action, and `output: 'export'`
 * refuses to build one — reasonably, since there would be nothing at the other
 * end to receive it. `scripts/export-static.mjs` swaps this component in for
 * the real one during that build (see the alias in next.config.ts), which is
 * why nothing else on the contact page has to know about any of this.
 *
 * It renders a notice rather than a dead form. A form that looks like it works
 * and silently discards what someone typed is worse than no form, and anyone
 * writing to a diocese is usually writing about something that matters to
 * them. The office's telephone number and address are on the page already, and
 * this points at them.
 */
export function ContactForm({
  locale,
  phoneHref,
  phoneLabel,
}: {
  labels: ContactLabels
  locale: string
  phoneHref: string
  phoneLabel: string
}) {
  // This one is a server component, unlike the form it replaces, so it can
  // read the dictionary itself rather than have the wording passed in — which
  // keeps the contact page free of a prop that only the stub would ever use.
  const t = getDictionary(isLocale(locale) ? locale : DEFAULT_LOCALE)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      {/* No heading: the page already has "Send a message" above this. */}
      <p className="text-sm text-amber-900">{t.contact.previewNotice}</p>

      <a
        href={phoneHref}
        className="mt-4 inline-block rounded-md bg-amber-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-800"
      >
        {phoneLabel}
      </a>
    </div>
  )
}
