import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAnySession } from './auth-context'
import { renderInvoice } from './e-invoice'
import { loadInvoiceDocument } from './invoice-documents.server'

// Invoice and Stornorechnung PDFs are rendered on the server (ZUGFeRD
// e-invoice); the browser only saves the result.
export const getInvoicePdf = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ invoiceId: z.string().min(1), kind: z.enum(['invoice', 'cancellation']).default('invoice') }).parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    if (caller.role === 'employee') throw new Error('FORBIDDEN')

    const doc = await loadInvoiceDocument(getServiceSupabaseClient(), data.invoiceId, data.kind)
    if (!doc || (caller.role === 'customer' && doc.company.id !== caller.companyId)) {
      throw new Error('NOT_FOUND')
    }

    const rendered = await renderInvoice(doc)
    return { base64: Buffer.from(rendered.pdf).toString('base64'), fileName: rendered.fileName }
  })
