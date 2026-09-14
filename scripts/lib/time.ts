/**
 * Turning a time somebody typed into the instant Payload stores.
 *
 * Kept in its own file so it can be checked directly — see
 * scripts/check-time-parsing.ts. This is the most safety-critical function in
 * the worksheet import: everything else it gets wrong is embarrassing, but a
 * wrong mass time sends a person to a locked church.
 */

/** India is UTC+5:30 all year round, so a fixed offset is correct. */
export const IST_OFFSET_MINUTES = 330

export type ParsedTime = { iso: string } | { error: string }

/**
 * Parse a time of day.
 *
 * Accepts "6:00 am", "6 pm", "6.30am", "18:30", "00:15".
 *
 * **Rejects a bare 1-12 hour with no am/pm.** "6:00" could be the morning mass
 * or the evening one. Guessing would be a coin flip on the single most
 * consequential value on the site, so it is refused and reported instead.
 * A 24-hour value can only mean one thing, so 13:00-23:59 and 00:xx are fine.
 *
 * The returned instant is the one whose Asia/Kolkata wall clock equals the
 * time given, because that is the timezone every part of the site formats in
 * (src/lib/services.ts pins it, to avoid hydration mismatches). Only the time
 * of day is ever read back, so the date part is fixed at the epoch.
 */
export const parseTime = (input: string): ParsedTime => {
  const text = input.trim().toLowerCase().replace(/\s+/g, '')
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/.exec(text)

  if (!match) {
    return { error: `"${input}" is not a time. Write it like "6:00 am" or "6:30 pm".` }
  }

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const suffix = match[3]

  if (minute > 59) return { error: `"${input}" has more than 59 minutes.` }

  if (suffix) {
    if (hour < 1 || hour > 12) {
      return { error: `"${input}" uses am/pm, so the hour must be 1-12.` }
    }
    if (suffix === 'pm' && hour !== 12) hour += 12
    if (suffix === 'am' && hour === 12) hour = 0
  } else if (hour >= 1 && hour <= 12) {
    const padded = String(minute).padStart(2, '0')
    return {
      error: `"${input}" is ambiguous — it could be morning or evening. Write "${hour}:${padded} am" or "${hour}:${padded} pm".`,
    }
  } else if (hour > 23) {
    return { error: `"${input}" has an hour above 23.` }
  }

  const minutesFromMidnightUtc = hour * 60 + minute - IST_OFFSET_MINUTES
  return { iso: new Date(minutesFromMidnightUtc * 60_000).toISOString() }
}

/** The inverse, used when writing the worksheet back out. */
export const formatTimeForWorksheet = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso))
