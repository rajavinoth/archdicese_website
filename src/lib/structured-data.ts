import { HTML_LANG, localePath, type Locale } from '@/lib/i18n'
import { OFFICE, SITE_URL, absoluteUrl } from '@/lib/site'

/**
 * schema.org JSON-LD builders.
 *
 * Why bother: a diocese's pages are exactly the kind of thing search engines
 * show enriched results for — a church with an address, a priest, a dated
 * event. Without this markup Google has to guess what a page is about from the
 * prose, and for a parish page whose useful content is a timings table it
 * usually guesses wrong.
 *
 * Rule followed throughout: a property is emitted only when the data actually
 * exists. Structured data that overstates what the site knows is worse than
 * none — it is the machine-readable version of inventing an address, and
 * Google penalises markup that disagrees with the visible page.
 */

type Json = Record<string, unknown>

/** Strip keys whose value is null/undefined/empty so nothing is asserted blindly. */
const compact = (input: Json): Json =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }),
  )

const canonical = (path: string, locale: Locale) =>
  absoluteUrl(localePath(path, locale))

/** The archdiocese itself, referenced by @id from everything else. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`

export const organizationSchema = (siteName: string): Json => ({
  '@type': 'ReligiousOrganization',
  '@id': ORGANIZATION_ID,
  name: siteName,
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: OFFICE.lines[0],
    addressLocality: 'Chennai',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN',
    // No postcode: the archdiocese has never published one for the office.
  },
  telephone: OFFICE.phones.map((phone) => phone.label),
  email: OFFICE.email,
})

/**
 * The site, with its search endpoint declared so Google can offer a search box
 * in the results for the diocese.
 */
export const websiteSchema = (siteName: string, locale: Locale): Json => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: siteName,
  url: canonical('/', locale),
  inLanguage: HTML_LANG[locale],
  publisher: { '@id': ORGANIZATION_ID },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${canonical('/search', locale)}?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
})

type ParishInput = {
  name: string
  slug: string
  patron?: string | null
  phone?: string | null
  email?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    pincode?: string | null
  } | null
}

/**
 * A parish is a `Church` — a place of worship, not an organisation. Most
 * parishes currently have nothing but a name and a URL, which is honest: the
 * archdiocese has not published their addresses.
 */
export const churchSchema = (parish: ParishInput, locale: Locale): Json => {
  const street = [parish.address?.line1, parish.address?.line2]
    .filter(Boolean)
    .join(', ')

  const hasAddress = Boolean(street || parish.address?.city)

  return compact({
    '@type': 'Church',
    name: parish.name,
    url: canonical(`/parishes/${parish.slug}`, locale),
    parentOrganization: { '@id': ORGANIZATION_ID },
    address: hasAddress
      ? compact({
          '@type': 'PostalAddress',
          streetAddress: street || undefined,
          addressLocality: parish.address?.city ?? undefined,
          postalCode: parish.address?.pincode ?? undefined,
          addressRegion: 'Tamil Nadu',
          addressCountry: 'IN',
        })
      : undefined,
    geo:
      parish.latitude != null && parish.longitude != null
        ? {
            '@type': 'GeoCoordinates',
            latitude: parish.latitude,
            longitude: parish.longitude,
          }
        : undefined,
    telephone: parish.phone ?? undefined,
    email: parish.email ?? undefined,
  })
}

type ClergyInput = {
  name: string
  slug: string
  honorific?: string | null
  currentAssignment?: string | null
  contactPublic?: boolean | null
  email?: string | null
  phone?: string | null
}

const HONORIFIC_LABEL: Record<string, string> = {
  fr: 'Rev. Fr.',
  msgr: 'Rt. Rev. Msgr.',
  bishop: 'Most Rev.',
  archbishop: 'Most Rev.',
}

export const personSchema = (priest: ClergyInput, locale: Locale): Json =>
  compact({
    '@type': 'Person',
    name: priest.name,
    honorificPrefix: priest.honorific
      ? (HONORIFIC_LABEL[priest.honorific] ?? undefined)
      : undefined,
    url: canonical(`/clergy/${priest.slug}`, locale),
    jobTitle: priest.currentAssignment ?? undefined,
    affiliation: { '@id': ORGANIZATION_ID },
    // Contact details only when the priest has opted in, matching the
    // field-level access control. JSON-LD is public text like any other.
    email: priest.contactPublic ? (priest.email ?? undefined) : undefined,
    telephone: priest.contactPublic ? (priest.phone ?? undefined) : undefined,
  })

type EventInput = {
  title: string
  slug: string
  startDate: string
  endDate?: string | null
  allDay?: boolean | null
  location?: string | null
}

/**
 * schema.org wants a plain date for an all-day event and a full timestamp
 * otherwise. Ours are stored as midnight UTC, so the date parts are read in
 * UTC — reading them in India time would move the event to the previous day.
 */
const schemaDate = (iso: string, allDay: boolean): string | undefined => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  return allDay ? date.toISOString().slice(0, 10) : date.toISOString()
}

export const eventSchema = (event: EventInput, locale: Locale): Json => {
  const allDay = Boolean(event.allDay)

  return compact({
    '@type': 'Event',
    name: event.title,
    url: canonical(`/events/${event.slug}`, locale),
    startDate: schemaDate(event.startDate, allDay),
    endDate: event.endDate ? schemaDate(event.endDate, allDay) : undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@id': ORGANIZATION_ID },
    location: event.location
      ? { '@type': 'Place', name: event.location }
      : undefined,
  })
}

type ArticleInput = {
  title: string
  slug: string
  publishedAt?: string | null
  updatedAt?: string | null
  excerpt?: string | null
}

export const articleSchema = (post: ArticleInput, locale: Locale): Json =>
  compact({
    '@type': 'NewsArticle',
    headline: post.title,
    url: canonical(`/news/${post.slug}`, locale),
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? undefined,
    description: post.excerpt ?? undefined,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  })

/**
 * Breadcrumbs. Google shows these in place of the raw URL, which matters most
 * on the deep pages — "Archdiocese › Parishes › Adyar" reads far better than
 * a bare address.
 */
export const breadcrumbSchema = (
  trail: { name: string; path: string }[],
  locale: Locale,
): Json => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((step, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: step.name,
    item: canonical(step.path, locale),
  })),
})

/** Wrap one or more schemas in a single @graph document. */
export const graph = (...nodes: Json[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
})
