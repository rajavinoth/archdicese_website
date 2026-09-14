/**
 * Choosing the verse of the day.
 *
 * Deliberately *not* random. Three reasons:
 *
 *  1. A random pick would give two visitors a different verse at the same
 *     moment, and the parish office fielding "which verse is on the site
 *     today?" could not answer.
 *  2. The homepage is prerendered and revalidated. A value that changes on
 *     every render produces a hydration mismatch and defeats the cache.
 *  3. It has to turn over at midnight in Chennai, not at midnight UTC — which
 *     is 5:30am local, so a UTC-based day would change the verse halfway
 *     through the morning.
 *
 * So the day number is taken from the date in India, and it indexes the pool.
 * Same verse for everyone, all day, changing overnight.
 */

const IST = 'Asia/Kolkata'

/** Days since the epoch, counted in India. */
export const istDayNumber = (now: Date = new Date()): number => {
  // en-CA gives ISO-ordered parts (YYYY-MM-DD), which parse unambiguously.
  const local = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: IST,
  }).format(now)

  return Math.floor(Date.parse(`${local}T00:00:00Z`) / 86_400_000)
}

/**
 * Pick one item from a pool for today.
 *
 * The pool must be in a stable order — sort it by something that does not
 * change, or the verse will jump about when a new one is added. The caller
 * sorts by `reference`.
 */
export const pickForToday = <T>(pool: T[], now?: Date): T | null => {
  if (pool.length === 0) return null
  return pool[istDayNumber(now) % pool.length]
}
