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
    '{STORNONUMMER}': doc.cancellation?.cancelId ?? '',
    '{STORNODATUM}': doc.cancellation ? germanDate(doc.cancellation.issueDate) : '',
  }
}

// Invoice mail, or the Stornorechnung mail for a cancellation.
export function buildInvoiceEmail(
  doc: InvoiceDocument,
  settings: Pick<
    EmailSettingsRow,
    'invoice_subject_template' | 'invoice_body_template' | 'cancellation_subject_template' | 'cancellation_body_template'
  >,
) {
  const values = invoiceEmailValues(doc)
  const subject = doc.cancellation ? settings.cancellation_subject_template : settings.invoice_subject_template
  const body = doc.cancellation ? settings.cancellation_body_template : settings.invoice_body_template
  return {
    // A subject is a single line.
    subject: fillTemplate(subject, values).replace(/\s*\n\s*/g, ' ').trim(),
    text: fillTemplate(body, values),
  }
}
