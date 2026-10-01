import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { isValidEmail } from '#/utils/email'
import { requireAdminSession } from './middleware/require-admin-session'
import { documentNumber, eInvoiceProblems, renderInvoice, type InvoiceDocument } from './e-invoice'
import { type DocumentKind, loadInvoiceDocument } from './invoice-documents.server'
import { buildInvoiceEmail } from './invoice-email-content'
import {
  DEV_MAILPIT,
  describeMailError,
  emailSettingsProblems,
  isMailpitOnly,
  loadEmailSettings,
  sendMail,
} from './mailer.server'

// Reasons a document can't be sent at all (the dialog shows them per row).
function blockingProblem(doc: InvoiceDocument) {
  if (!doc.company.email) return 'Kunde hat keine E-Mail-Adresse (Kunden → bearbeiten)'
  if (!isValidEmail(doc.company.email)) return `E-Mail-Adresse des Kunden ungültig: ${doc.company.email}`
  return null
}

export async function lastSentAtByInvoice(supabase: SupabaseClient, invoiceIds: string[], kind: DocumentKind = 'invoice') {
  const sentAt = new Map<string, string>()
  if (!invoiceIds.length) return sentAt
  const { data } = await supabase
    .from('invoice_emails')
    .select('invoice_id, sent_at')
    .in('invoice_id', invoiceIds)
    .eq('document_kind', kind)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
  for (const row of data ?? []) {
    if (!sentAt.has(row.invoice_id)) sentAt.set(row.invoice_id, row.sent_at)
  }
  return sentAt
}

// Everything the send dialog shows before anything goes out: recipient, the
// filled-in mail and warnings per invoice. For a cancelled invoice the
// document to send is its Stornorechnung.
export const adminPrepareInvoiceEmails = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => z.object({ invoiceIds: z.array(z.string().min(1)).min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const settings = await loadEmailSettings(supabase)
    const invoiceSentAt = await lastSentAtByInvoice(supabase, data.invoiceIds, 'invoice')
    const cancellationSentAt = await lastSentAtByInvoice(supabase, data.invoiceIds, 'cancellation')

    const items = []
    for (const invoiceId of data.invoiceIds) {
      const invoice = await loadInvoiceDocument(supabase, invoiceId)
      if (!invoice) continue
      const kind: DocumentKind = invoice.records[0].status === 'storniert' ? 'cancellation' : 'invoice'
      const doc = kind === 'cancellation' ? await loadInvoiceDocument(supabase, invoiceId, 'cancellation') : invoice
      if (!doc) continue
      const mail = buildInvoiceEmail(doc, settings)
      items.push({
        invoiceId,
        kind,
        documentNumber: documentNumber(doc),
        companyName: doc.company.name,
        recipient: doc.company.email,
        subject: mail.subject,
        text: mail.text,
        eInvoiceProblems: eInvoiceProblems(doc),
        blocking: blockingProblem(doc),
        // This very document was already e-mailed (don't send it twice).
        lastSentAt: (kind === 'cancellation' ? cancellationSentAt : invoiceSentAt).get(invoiceId) ?? null,
        // For a Stornorechnung: whether the customer got the invoice by mail.
        invoiceSentAt: kind === 'cancellation' ? (invoiceSentAt.get(invoiceId) ?? null) : null,
      })
    }

    return {
      settingsProblems: emailSettingsProblems(settings),
      bcc: settings.bcc,
      fromAddress: settings.from_address,
      mailpitUrl: isMailpitOnly ? DEV_MAILPIT.webUrl : null,
      items,
    }
  })

// Sends one invoice or Stornorechnung (the dialog calls this one by one and
// shows progress). Every attempt is logged in invoice_emails.
export const adminSendInvoiceEmail = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) =>
    z.object({ invoiceId: z.string().min(1), kind: z.enum(['invoice', 'cancellation']) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const settings = await loadEmailSettings(supabase)
    const settingsProblems = emailSettingsProblems(settings)
    if (settingsProblems.length) return { ok: false, message: `E-Mail-Einstellungen: ${settingsProblems.join(', ')}` } as const

    const doc = await loadInvoiceDocument(supabase, data.invoiceId, data.kind)
    if (!doc) {
      return { ok: false, message: data.kind === 'cancellation' ? 'Stornorechnung nicht gefunden.' : 'Rechnung nicht gefunden.' } as const
    }
    // A cancelled invoice itself must not go out any more.
    if (data.kind === 'invoice' && doc.records[0].status === 'storniert') {
      return { ok: false, message: 'Rechnung ist storniert.' } as const
    }
    const blocking = blockingProblem(doc)
    if (blocking) return { ok: false, message: blocking } as const

    const recipient = doc.company.email!.trim()
    const mail = buildInvoiceEmail(doc, settings)
    let rendered
    try {
      rendered = await renderInvoice(doc)
    } catch (error) {
      return { ok: false, message: `PDF konnte nicht erzeugt werden: ${(error as Error).message}` } as const
    }

    const logEntry = {
      invoice_id: doc.invoiceId,
      document_kind: data.kind,
      company_id: doc.company.id,
      recipient,
      bcc: settings.bcc.trim(),
      subject: mail.subject,
      e_invoice: rendered.eInvoice,
    }
    try {
      const { messageId } = await sendMail(settings, {
        to: recipient,
        bcc: settings.bcc,
        subject: mail.subject,
        text: mail.text,
        attachments: [{ filename: rendered.fileName, content: Buffer.from(rendered.pdf), contentType: 'application/pdf' }],
      })
      const { data: logged } = await supabase
        .from('invoice_emails')
        .insert({ ...logEntry, status: 'sent', message_id: messageId })
        .select('sent_at')
        .single()
      return { ok: true, sentAt: logged?.sent_at ?? new Date().toISOString(), eInvoice: rendered.eInvoice } as const
    } catch (error) {
      const message = describeMailError(error)
      await supabase.from('invoice_emails').insert({ ...logEntry, status: 'failed', error: message })
      return { ok: false, message } as const
    }
  })
