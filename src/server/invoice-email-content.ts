import type { EmailSettingsRow } from '#/lib/supabase/types'
import { formatBerlinDate } from '#/utils/berlin-time'
import { fillTemplate, type InvoiceEmailValues } from '#/utils/email-template'
import { money } from '#/utils/history-utils'
import type { InvoiceDocument } from './e-invoice'

function germanDate(isoDate: string) {
  return formatBerlinDate(new Date(`${isoDate}T12:00:00Z`))
}

export function invoiceEmailValues(doc: InvoiceDocument): InvoiceEmailValues {
  return {
    '{KUNDE}': doc.company.name,
    '{KUNDENNUMMER}': doc.company.customerNumber,
    '{RECHNUNGSNUMMER}': doc.invoiceId,
    '{RECHNUNGSDATUM}': germanDate(doc.issueDate),
    '{BETRAG}': money(doc.totals.gross),
    '{FAELLIG_AM}': germanDate(doc.dueDate),
    '{BAUVORHABEN}': doc.constructionSites,
    '{LIEFERSCHEINE}': doc.deliveryNoteRefs,
  }
}

export function buildInvoiceEmail(
  doc: InvoiceDocument,
  settings: Pick<EmailSettingsRow, 'invoice_subject_template' | 'invoice_body_template'>,
) {
  const values = invoiceEmailValues(doc)
  return {
    // A subject is a single line.
    subject: fillTemplate(settings.invoice_subject_template, values).replace(/\s*\n\s*/g, ' ').trim(),
    text: fillTemplate(settings.invoice_body_template, values),
  }
}
