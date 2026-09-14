export const HONORIFIC_LABEL: Record<string, string> = {
  fr: 'Fr.',
  msgr: 'Msgr.',
  mostRev: 'Most Rev.',
  rev: 'Rev.',
}

export const STATUS_LABEL: Record<string, string> = {
  active: 'In active ministry',
  retired: 'Retired',
  away: 'On studies / outside the archdiocese',
  deceased: 'Deceased',
}

/** "fr" + "A. Amal Raj" -> "Fr. A. Amal Raj" */
export const formatClergyName = (
  honorific: string | null | undefined,
  name: string,
): string => [honorific ? HONORIFIC_LABEL[honorific] : '', name].filter(Boolean).join(' ')
