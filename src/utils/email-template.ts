// Placeholders for the invoice and Stornorechnung e-mails (subject and
// text), filled per document.
export const INVOICE_EMAIL_PLACEHOLDERS = [
  { token: '{KUNDE}', description: 'Name des Kunden' },
  { token: '{KUNDENNUMMER}', description: 'Kundennummer' },
  { token: '{RECHNUNGSNUMMER}', description: 'Rechnungsnummer' },
  { token: '{RECHNUNGSDATUM}', description: 'Rechnungsdatum' },
  { token: '{BETRAG}', description: 'Gesamtbetrag (brutto)' },
  { token: '{FAELLIG_AM}', description: 'Zahlbar bis' },
  { token: '{BAUVORHABEN}', description: 'Baustelle(n)' },
  { token: '{LIEFERSCHEINE}', description: 'Lieferschein-Nummern' },
  { token: '{STORNONUMMER}', description: 'Nummer der Stornorechnung (nur Storno)' },
  { token: '{STORNODATUM}', description: 'Datum der Stornorechnung (nur Storno)' },
] as const

/** Only meaningful in the Stornorechnung mail. */
export const CANCELLATION_ONLY_TOKENS: readonly InvoiceEmailToken[] = ['{STORNONUMMER}', '{STORNODATUM}']

export type InvoiceEmailToken = (typeof INVOICE_EMAIL_PLACEHOLDERS)[number]['token']
export type InvoiceEmailValues = Record<InvoiceEmailToken, string>

// Shown in the settings preview.
export const SAMPLE_INVOICE_EMAIL_VALUES: InvoiceEmailValues = {
  '{KUNDE}': 'Muster Bau GmbH',
  '{KUNDENNUMMER}': '10600',
  '{RECHNUNGSNUMMER}': 'RG-20261001-0001',
  '{RECHNUNGSDATUM}': '1.10.2026',
  '{BETRAG}': '909,04 €',
  '{FAELLIG_AM}': '15.10.2026',
  '{BAUVORHABEN}': 'Nordring 12, Bühl',
  '{LIEFERSCHEINE}': 'LS-20260928-0001, LS-20260930-0004',
  '{STORNONUMMER}': 'ST-20261005-17',
  '{STORNODATUM}': '5.10.2026',
}

export function fillTemplate(template: string, values: InvoiceEmailValues) {
  return template.replace(/\{[A-Z_]+\}/g, (token) => values[token as InvoiceEmailToken] ?? token)
}

/** Tokens in the template that are not placeholders (typos). */
export function unknownPlaceholders(template: string) {
  const known = new Set<string>(INVOICE_EMAIL_PLACEHOLDERS.map((p) => p.token))
  return [...new Set(template.match(/\{[^{}\s]*\}/g) ?? [])].filter((token) => !known.has(token))
}
