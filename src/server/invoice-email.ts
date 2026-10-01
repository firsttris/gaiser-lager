import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { isValidEmail } from '#/utils/email'
import { requireAdminSession } from './middleware/require-admin-session'
import { eInvoiceProblems, renderInvoice, type InvoiceDocument } from './e-invoice'
import { loadInvoiceDocument } from './invoice-documents.server'
import { buildInvoiceEmail } from './invoice-email-content'
import {
  DEV_MAILPIT,
  describeMailError,
  emailSettingsProblems,
  isMailpitOnly,
  loadEmailSettings,
  sendMail,
} from './mailer.server'

// Reasons an invoice can't be sent at all (the dialog shows them per row).
function blockingProblem(doc: InvoiceDocument) {
  if (doc.records[0].status === 'storniert') return 'Rechnung ist storniert'
  if (!doc.company.email) return 'Kunde hat keine E-Mail-Adresse (Kunden → bearbeiten)'
  if (!isValidEmail(doc.company.email)) return `E-Mail-Adresse des Kunden ungültig: ${doc.company.email}`
  return null
}

export async function lastSentAtByInvoice(supabase: SupabaseClient, invoiceIds: string[]) {
  const sentAt = new Map<string, string>()
  if (!invoiceIds.length) return sentAt
  const { data } = await supabase
    .from('invoice_emails')
    .select('invoice_id, sent_at')
    .in('invoice_id', invoiceIds)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
  for (const row of data ?? []) {
    if (!sentAt.has(row.invoice_id)) sentAt.set(row.invoice_id, row.sent_at)
  }
  return sentAt
}

// Everything the send dialog shows before anything goes out: recipient, the
// filled-in mail and warnings per invoice.
export const adminPrepareInvoiceEmails = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => z.object({ invoiceIds: z.array(z.string().min(1)).min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const settings = await loadEmailSettings(supabase)
    const sentAt = await lastSentAtByInvoice(supabase, data.invoiceIds)

    const items = []
    for (const invoiceId of data.invoiceIds) {
      const doc = await loadInvoiceDocument(supabase, invoiceId)
      if (!doc) continue
      const mail = buildInvoiceEmail(doc, settings)
      items.push({
        invoiceId,
        companyName: doc.company.name,
        recipient: doc.company.email,
        subject: mail.subject,
        text: mail.text,
        eInvoiceProblems: eInvoiceProblems(doc),
        blocking: blockingProblem(doc),
        lastSentAt: sentAt.get(invoiceId) ?? null,
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

// Sends one invoice (the dialog calls this one by one and shows progress).
// Every attempt is logged in invoice_emails.
export const adminSendInvoiceEmail = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => z.object({ invoiceId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const settings = await loadEmailSettings(supabase)
    const settingsProblems = emailSettingsProblems(settings)
    if (settingsProblems.length) return { ok: false, message: `E-Mail-Einstellungen: ${settingsProblems.join(', ')}` } as const

    const doc = await loadInvoiceDocument(supabase, data.invoiceId)
    if (!doc) return { ok: false, message: 'Rechnung nicht gefunden.' } as const
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
