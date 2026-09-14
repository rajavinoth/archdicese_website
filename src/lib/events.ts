const IST = 'Asia/Kolkata'

/**
 * All-day events are stored as a midnight-to-midnight range, so formatting
 * them in a timezone can shift the displayed date by a day. Those are rendered
 * from the UTC date parts; timed events are rendered in India time.
 */
export const formatEventDate = (
  iso: string | null | undefined,
  allDay: boolean,
  locale: string = 'en',
): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN'

  if (allDay) {
    return new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }

  return new Intl.DateTimeFormat(tag, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(date)
}

/** Month heading used to group the listing, e.g. "May 2022". */
export const monthKey = (
  iso: string | null | undefined,
  locale: string = 'en',
): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export const isUpcoming = (iso: string | null | undefined): boolean => {
  if (!iso) return false
  const date = new Date(iso)
  return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now()
}
