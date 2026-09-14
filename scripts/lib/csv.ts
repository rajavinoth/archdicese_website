/**
 * CSV reading and writing for the curia worksheets.
 *
 * Hand-rolled rather than pulled from npm, because the requirements are small
 * and fixed — but NOT hand-waved. Splitting on commas is wrong for this data
 * in particular: a parish address is "41, Santhome High Road", and a mass note
 * is "First Friday only, except Lent". Both must survive a round trip, so this
 * is a real RFC 4180 reader and writer.
 *
 * Excel-specific details that matter here:
 *
 *  - A **UTF-8 BOM** is written at the start of every file. Without it, Excel
 *    on Windows reads the file as the local codepage and Tamil parish names
 *    turn into mojibake — and then get saved back that way, corrupting the
 *    data for good.
 *  - Lines end **CRLF**, which is what Excel writes, so a file that is opened
 *    and saved untouched produces no spurious diff.
 *  - The reader accepts LF, CRLF or a BOM, because the file may come back from
 *    Excel, LibreOffice, Google Sheets or a text editor.
 */

const BOM = '﻿'

/** Does this value need quoting? */
const needsQuotes = (value: string): boolean =>
  value.includes(',') ||
  value.includes('"') ||
  value.includes('\n') ||
  value.includes('\r') ||
  value !== value.trim()

const escapeField = (value: string): string =>
  needsQuotes(value) ? `"${value.replaceAll('"', '""')}"` : value

export type Row = Record<string, string>

/** Write rows as CSV. Column order and header come from `columns`. */
export const toCsv = (columns: string[], rows: Row[]): string => {
  const lines = [columns.map(escapeField).join(',')]

  for (const row of rows) {
    lines.push(columns.map((column) => escapeField(row[column] ?? '')).join(','))
  }

  return BOM + lines.join('\r\n') + '\r\n'
}

/**
 * Parse CSV into rows keyed by the header line.
 *
 * Walks the text one character at a time rather than using a regex: a quoted
 * field can contain a newline, so the file cannot first be split into lines.
 */
export const parseCsv = (input: string): Row[] => {
  const text = input.startsWith(BOM) ? input.slice(1) : input

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0

  const endField = () => {
    row.push(field)
    field = ''
  }

  const endRow = () => {
    endField()
    // Ignore a trailing blank line, and any row that is entirely empty.
    if (row.some((value) => value !== '')) rows.push(row)
    row = []
  }

  while (index < text.length) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index++
        continue
      }
      field += char
      index++
      continue
    }

    if (char === '"' && field === '') {
      inQuotes = true
      index++
      continue
    }

    if (char === ',') {
      endField()
      index++
      continue
    }

    if (char === '\r' || char === '\n') {
      endRow()
      // Consume CRLF as one line break.
      index += char === '\r' && text[index + 1] === '\n' ? 2 : 1
      continue
    }

    field += char
    index++
  }

  // Whatever is left over when the text ends without a newline.
  if (field !== '' || row.length > 0) endRow()

  const [header, ...body] = rows
  if (!header) return []

  const columns = header.map((column) => column.trim())

  return body.map((values) => {
    const record: Row = {}
    columns.forEach((column, position) => {
      record[column] = (values[position] ?? '').trim()
    })
    return record
  })
}
