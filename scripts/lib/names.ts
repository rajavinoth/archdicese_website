/**
 * Priest-name matching, shared by every script that has to line up a name in
 * the appointments letter with a record in the directory.
 *
 * This lives in one file on purpose. Three scripts now compare these names
 * (appointments-apply, parishes-apply, worksheet-export) and if their idea of
 * "the same priest" ever diverges, one of them will silently create a
 * duplicate priest in the directory of a real diocese.
 */

/**
 * Compare names on their sorted word tokens, so honorifics and word order stop
 * mattering: the letter writes "Rev Fr E Arulappa", our records "Arulappa E".
 *
 * Deliberately strict about the tokens themselves — it will not match
 * "D F Don Bosco" to "Bosco Y F", who are different priests.
 */
export const nameKey = (input: string): string =>
  input
    .toLowerCase()
    .replace(/\b(rev|fr|msgr|most|very|dr)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')

/** Edit distance, used only to spot near-identical names. */
export const editDistance = (a: string, b: string): number => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ])
  for (let j = 0; j <= b.length; j++) rows[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return rows[a.length][b.length]
}

/**
 * Finds records that are probably the same priest spelled differently.
 *
 * The letter and the old website do not agree on spellings: the letter has
 * "Arockia Velankanni Stalin", our record says "Arokia Velankanni Stalin".
 * Those are one priest, and blindly creating the letter's version would put a
 * duplicate in the directory. Anything suspicious is reported for a human
 * instead of being created.
 */
export const findNearMatch = <T extends { name: string }>(
  key: string,
  candidates: Map<string, T>,
): T | null => {
  /**
   * Only real name parts count as evidence. Single letters are initials, and
   * far too common to mean anything: matching on those alone paired
   * "G J Jasper" with "Anthonysamy G J", and "S Alexraj" with "Balraj S" —
   * different priests in both cases.
   */
  const words = new Set(key.split(' ').filter((token) => token.length >= 3))

  for (const [otherKey, doc] of candidates) {
    const otherWords = otherKey.split(' ').filter((token) => token.length >= 3)
    const shared = otherWords.filter((token) => words.has(token)).length

    // Two shared name parts, or one plus a near-identical spelling overall.
    if (shared >= 2) return doc
    if (shared >= 1 && editDistance(key, otherKey) <= 2) return doc
  }

  return null
}

/** "Rev Fr S X Amalraj" -> "S X Amalraj" */
export const stripHonorific = (input: string): string =>
  input.replace(/^\s*(rev\.?\s*)?(fr\.?|msgr\.?|most\s+rev\.?)\s*/i, '').trim()

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
