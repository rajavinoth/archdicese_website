/**
 * Helpers for parish service timings (mass, novena, adoration, confession).
 */

export const DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export type Day = (typeof DAYS)[number]

const DAY_LABELS: Record<string, Record<Day, string>> = {
  en: {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  },
  ta: {
    sunday: 'ஞாயிறு',
    monday: 'திங்கள்',
    tuesday: 'செவ்வாய்',
    wednesday: 'புதன்',
    thursday: 'வியாழன்',
    friday: 'வெள்ளி',
    saturday: 'சனி',
  },
}

/** English labels, kept for code that has no locale to hand. */
export const DAY_LABEL = DAY_LABELS.en

export const dayLabel = (day: string, locale: string = 'en'): string =>
  (DAY_LABELS[locale] ?? DAY_LABELS.en)[day as Day] ?? day

const LANGUAGE_LABELS: Record<string, Record<string, string>> = {
  en: {
    tamil: 'Tamil',
    english: 'English',
    telugu: 'Telugu',
    hindi: 'Hindi',
    malayalam: 'Malayalam',
    latin: 'Latin',
  },
  ta: {
    tamil: 'தமிழ்',
    english: 'ஆங்கிலம்',
    telugu: 'தெலுங்கு',
    hindi: 'இந்தி',
    malayalam: 'மலையாளம்',
    latin: 'இலத்தீன்',
  },
}

export const LANGUAGE_LABEL = LANGUAGE_LABELS.en

export const languageLabel = (code: string, locale: string = 'en'): string =>
  (LANGUAGE_LABELS[locale] ?? LANGUAGE_LABELS.en)[code] ?? code

const KIND_LABELS: Record<string, Record<string, string>> = {
  en: {
    mass: 'Mass',
    novena: 'Novena',
    adoration: 'Adoration',
    confession: 'Confession',
  },
  ta: {
    mass: 'திருப்பலி',
    novena: 'நவநாள்',
    adoration: 'ஆராதனை',
    confession: 'பாவசங்கீர்த்தனம்',
  },
}

export const KIND_LABEL = KIND_LABELS.en

export const kindLabel = (kind: string, locale: string = 'en'): string =>
  (KIND_LABELS[locale] ?? KIND_LABELS.en)[kind] ?? kind

/**
 * Payload's time-only picker still stores a full ISO instant, so the rendered
 * time depends on the timezone doing the formatting. The server often runs in
 * UTC while the visitor's browser does not -- formatting without pinning a
 * timezone gives two different strings for the same record and React reports a
 * hydration mismatch.
 *
 * The archdiocese is in Chennai, so India is the correct fixed reference.
 */
const IST = 'Asia/Kolkata'

const timeFormatters: Record<string, Intl.DateTimeFormat> = {}

const timeFormatter = (locale: string) => {
  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN'
  timeFormatters[tag] ??= new Intl.DateTimeFormat(tag, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  })
  return timeFormatters[tag]
}

export const formatTime = (
  iso: string | null | undefined,
  locale: string = 'en',
): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return timeFormatter(locale).format(date)
}

/** Minutes since midnight IST, for sorting services within a day. */
export const minutesOfDay = (iso: string | null | undefined): number => {
  if (!iso) return 0
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0

  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  }).formatToParts(date)

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export type Service = {
  kind: string
  day: string
  time?: string | null
  language?: string | null
  note?: string | null
}

/** Morning / afternoon / evening buckets, for the "when can I go" filter. */
export type TimeBand = 'morning' | 'afternoon' | 'evening'

export const bandOf = (iso: string | null | undefined): TimeBand => {
  const minutes = minutesOfDay(iso)
  if (minutes < 12 * 60) return 'morning'
  if (minutes < 16 * 60) return 'afternoon'
  return 'evening'
}

const BAND_LABELS: Record<string, Record<TimeBand, string>> = {
  en: {
    morning: 'Morning (before noon)',
    afternoon: 'Afternoon (12pm - 4pm)',
    evening: 'Evening (after 4pm)',
  },
  ta: {
    morning: 'காலை (நண்பகலுக்கு முன்)',
    afternoon: 'மதியம் (12 - 4 மணி)',
    evening: 'மாலை (4 மணிக்குப் பின்)',
  },
}

export const BAND_LABEL = BAND_LABELS.en

export const bandLabels = (locale: string = 'en'): Record<TimeBand, string> =>
  BAND_LABELS[locale] ?? BAND_LABELS.en

/** Group a parish's services by day, in liturgical week order. */
export const groupByDay = (services: Service[]): { day: Day; services: Service[] }[] =>
  DAYS.map((day) => ({
    day,
    services: services
      .filter((service) => service.day === day)
      .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time)),
  })).filter((group) => group.services.length > 0)
