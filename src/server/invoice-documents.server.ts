import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCancellationDocument, buildInvoiceDocument, type InvoiceDocument } from './e-invoice'
import { toRecord } from './records'

export type DocumentKind = 'invoice' | 'cancellation'

// The invoice, or (kind 'cancellation') its Stornorechnung — null if the
// invoice doesn't exist or isn't cancelled.
export async function loadInvoiceDocument(
  supabase: SupabaseClient,
  invoiceId: string,
  kind: DocumentKind = 'invoice',
): Promise<InvoiceDocument | null> {
  const { data: rows } = await supabase.from('records').select('*').eq('invoice_id', invoiceId).order('id')
  if (!rows?.length) return null
  const records = rows.map(toRecord)

  const { data: company } = await supabase
    .from('companies')
    .select('customer_number, street, postal_code, city, email')
    .eq('id', records[0].companyId)
    .maybeSingle()

  const companyData = {
    customerNumber: company?.customer_number ?? '',
    street: company?.street ?? '',
    postalCode: company?.postal_code ?? '',
    city: company?.city ?? '',
    email: company?.email ?? null,
  }
  return kind === 'cancellation'
    ? buildCancellationDocument(records, companyData)
    : buildInvoiceDocument(invoiceId, records, companyData)
}
