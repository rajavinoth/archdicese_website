import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContactForm } from '@/components/ContactForm'
import { LOCALES, getDictionary, isLocale, localePath, alternatesFor } from '@/lib/i18n'
import { OFFICE } from '@/lib/site'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return {
    title: t.contact.title,
    description: t.contact.intro,
    alternates: alternatesFor('/contact', locale),
  }
}

/**
 * The office details now live in src/lib/site.ts, because the structured data
 * on the homepage needs the same address and two copies would drift apart.
 */
const mapQuery = encodeURIComponent(OFFICE.fullAddress)

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t.contact.title}</h1>
        <p className="mt-3 text-slate-600">{t.contact.intro}</p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        {/* Form */}
        <section>
          <h2 className="text-lg font-semibold">{t.contact.sendMessage}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.contact.requiredNote}</p>

          <div className="mt-6">
            <ContactForm
              locale={locale}
              phoneHref={OFFICE.phones[0].href}
              phoneLabel={OFFICE.phones[0].label}
              labels={{
                name: t.contact.name,
                email: t.contact.email,
                phone: t.contact.phone,
                optional: t.contact.optional,
                topic: t.contact.topic,
                subject: t.contact.subject,
                message: t.contact.message,
                send: t.contact.send,
                sending: t.contact.sending,
                thanks: t.contact.thanks,
                thanksBody: t.contact.thanksBody,
                privacyNote: t.contact.privacyNote,
                topics: t.contact.topics,
              }}
            />
          </div>
        </section>

        {/* Details */}
        <aside className="space-y-8 text-sm">
          <div>
            <h2 className="font-semibold text-slate-900">{OFFICE.name}</h2>
            <address className="mt-2 not-italic text-slate-600">
              {OFFICE.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <a
              href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-slate-700 underline hover:text-slate-900"
            >
              {t.contact.findOnMap}
            </a>
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">{t.contact.telephone}</h2>
            <ul className="mt-2 space-y-1 text-slate-600">
              {OFFICE.phones.map((phone) => (
                <li key={phone.href}>
                  <a href={phone.href} className="hover:underline">
                    {phone.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">{t.contact.email}</h2>
            <p className="mt-2 text-slate-600">
              <a href={`mailto:${OFFICE.email}`} className="hover:underline">
                {OFFICE.email}
              </a>
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-900">
              {t.contact.lookingForParish}
            </h2>
            <p className="mt-2 text-slate-600">{t.contact.lookingForParishBody}</p>
            <Link
              href={localePath('/parishes', locale)}
              className="mt-2 inline-block text-slate-700 underline hover:text-slate-900"
            >
              {t.home.findParish}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
