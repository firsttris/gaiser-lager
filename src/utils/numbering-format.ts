import { berlinDateParts } from './berlin-time'

// Keep in sync with public.format_document_number() in the database, which
// formats invoice numbers the same way.
export function formatGeneratedNumber(template: string, counter: number, padding: number, at: Date = new Date()) {
  const { year, month, day } = berlinDateParts(at)
  const jahr = String(year)
  const monat = String(month).padStart(2, '0')
  const tag = String(day).padStart(2, '0')
  const nummer = String(counter).padStart(Math.max(padding, 1), '0')

  return template
    .replaceAll('{JAHR}', jahr)
    .replaceAll('{MONAT}', monat)
    .replaceAll('{TAG}', tag)
    .replaceAll('{NUMMER}', nummer)
}
