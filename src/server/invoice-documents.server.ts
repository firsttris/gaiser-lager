import type { SupabaseClient } from '@supabase/supabase-js'
import { buildInvoiceDocument, type InvoiceDocument } from './e-invoice'
import { toRecord } from './records'

export async function loadInvoiceDocument(supabase: SupabaseClient, invoiceId: string): Promise<InvoiceDocument | null> {
  const { data: rows } = await supabase.from('records').select('*').eq('invoice_id', invoiceId).order('id')
  if (!rows?.length) return null
  const records = rows.map(toRecord)

  const { data: company } = await supabase
    .from('companies')
    .select('customer_number, street, postal_code, city, email')
    .eq('id', records[0].companyId)
    .maybeSingle()

  return buildInvoiceDocument(invoiceId, records, {
    customerNumber: company?.customer_number ?? '',
    street: company?.street ?? '',
    postalCode: company?.postal_code ?? '',
    city: company?.city ?? '',
    email: company?.email ?? null,
  })
}
