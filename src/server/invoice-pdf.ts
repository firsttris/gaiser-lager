import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAnySession } from './auth-context'
import { renderInvoice } from './e-invoice'
import { loadInvoiceDocument } from './invoice-documents.server'

// Invoice PDFs are rendered on the server (ZUGFeRD e-invoice); the browser
// only saves the result.
export const getInvoicePdf = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ invoiceId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    if (caller.role === 'employee') throw new Error('FORBIDDEN')

    const doc = await loadInvoiceDocument(getServiceSupabaseClient(), data.invoiceId)
    if (!doc || (caller.role === 'customer' && doc.company.id !== caller.companyId)) {
      throw new Error('NOT_FOUND')
    }

    const rendered = await renderInvoice(doc)
    return { base64: Buffer.from(rendered.pdf).toString('base64'), fileName: rendered.fileName }
  })
