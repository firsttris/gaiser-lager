import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { type CallerContext, requireAnySession } from './auth-context'
import { findOrCreateConstructionSite } from './construction-sites'
import { formatGeneratedNumber } from '#/utils/numbering-format'
import { berlinDayEndExclusive, berlinDayStart, formatBerlinDateTime } from '#/utils/berlin-time'
import { roundCents } from '#/utils/money'
import type { RecordRow } from '#/lib/supabase/types'
import type { RecordItem } from '../state/app-state'

const createRecordSchema = z.object({
  type: z.enum(['pickup', 'dropoff']),
  productId: z.number(),
  amount: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const createTruckRecordSchema = z.object({
  truckId: z.number(),
  hours: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const createInvoiceSchema = z.object({
  recordIds: z.array(z.number().int()).min(1),
})

const cancelRecordsSchema = z.object({
  recordIds: z.array(z.number().int()).min(1),
})

const markInvoicesPaidSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1),
})

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export function toRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    companyId: row.company_id,
    company: row.company_name,
    createdByName: row.created_by_name ?? undefined,
    constructionSiteId: row.construction_site_id ?? '',
    constructionSiteName: row.construction_site_name,
    type: row.type,
    productName: row.product_name,
    amount: row.amount,
    unit: row.unit,
    unitPrice: row.unit_price,
    total: row.total,
    status: row.status,
    createdAt: formatBerlinDateTime(row.created_at),
    createdAtIso: row.created_at,
    deliveryNoteId: row.delivery_note_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    invoiceReverseCharge: row.invoice_reverse_charge,
    invoicedAt: row.invoiced_at ?? undefined,
    cancelId: row.cancel_id ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
  }
}

// Resolves which company a record is created for and who booked it.
// Customers can only ever book for their own company (any companyId they send
// is ignored); employees and admins must say which company it is for.
async function resolveBooking(companyIdFromCaller: string | undefined) {
  const caller = await requireAnySession()
  const companyId = caller.role === 'customer' ? caller.companyId : (companyIdFromCaller ?? null)
  const bookedBy =
    caller.role === 'employee'
      ? { created_by_employee_id: caller.employeeId, created_by_name: caller.employeeName }
      : {}
  return { companyId, bookedBy }
}

// What each role may see: admins everything, customers their company's
// records, employees the records they booked themselves.
function scopeToCaller<Q extends { eq: (column: 'company_id' | 'created_by_employee_id', value: string) => Q }>(
  query: Q,
  caller: CallerContext,
): Q {
  if (caller.role === 'customer') return query.eq('company_id', caller.companyId)
  if (caller.role === 'employee') return query.eq('created_by_employee_id', caller.employeeId)
  return query
}

export const createRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const { companyId, bookedBy } = await resolveBooking(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: product }] = await Promise.all([
      supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
      supabase.from('products').select('*').eq('id', data.productId).maybeSingle(),
    ])
    // A product belongs to exactly one flow (Abholung or Anlieferung).
    if (!company || !product || product.flow !== data.type) return null

    const site = await findOrCreateConstructionSite(supabase, company.id, data.constructionSiteName)
    if (!site) return null

    const unitPrice = product.price
    const total = roundCents(unitPrice * data.amount)

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: data.type,
        product_name: product.name,
        amount: data.amount,
        unit: product.unit,
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
        ...bookedBy,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

export const createTruckRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createTruckRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const { companyId, bookedBy } = await resolveBooking(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: truck }] = await Promise.all([
      supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
      supabase.from('trucks').select('*').eq('id', data.truckId).maybeSingle(),
    ])
    if (!company || !truck) return null

    const site = await findOrCreateConstructionSite(supabase, company.id, data.constructionSiteName)
    if (!site) return null

    const unitPrice = truck.price
    const total = roundCents(unitPrice * data.hours)

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: 'lkw',
        product_name: truck.name,
        amount: data.hours,
        unit: 'Std.',
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
        ...bookedBy,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

const listRecordsPageSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(200),
  companyId: z.string().uuid().optional(),
  type: z.enum(['pickup', 'dropoff', 'lkw']).optional(),
  status: z.enum(['offen', 'lieferschein', 'rechnung', 'bezahlt', 'storniert']).optional(),
  search: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
})

// PostgREST's .or() takes a comma-separated filter list — strip characters
// that would let free-text search input break out of that syntax.
function sanitizeSearchTerm(search: string) {
  return search.replace(/[,()]/g, ' ').trim()
}

export const listRecordsPage = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listRecordsPageSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    const supabase = getServiceSupabaseClient()

    let query = supabase.from('records').select('*', { count: 'exact' })
    query = scopeToCaller(query, caller)
    if (caller.role !== 'customer' && data.companyId) query = query.eq('company_id', data.companyId)
    if (data.type) query = query.eq('type', data.type)
    if (data.status) query = query.eq('status', data.status)

    const search = data.search ? sanitizeSearchTerm(data.search) : ''
    if (search) {
      const term = `%${search}%`
      query = query.or(
        `company_name.ilike.${term},construction_site_name.ilike.${term},delivery_note_id.ilike.${term},invoice_id.ilike.${term},cancel_id.ilike.${term}`,
      )
    }

    if (data.dateFrom) query = query.gte('created_at', berlinDayStart(data.dateFrom).toISOString())
    if (data.dateTo) query = query.lt('created_at', berlinDayEndExclusive(data.dateTo).toISOString())

    const from = (data.page - 1) * data.pageSize
    const { data: rows, error, count } = await query
      .order('id', { ascending: false })
      .range(from, from + data.pageSize - 1)

    if (error || !rows) return { records: [], totalCount: 0 }
    return { records: rows.map(toRecord), totalCount: count ?? 0 }
  })

const listRecordsByDocIdSchema = z.object({
  field: z.enum(['delivery_note_id', 'invoice_id', 'cancel_id']),
  value: z.string(),
})

// Delivery notes / invoices / cancellations can combine records that no
// longer share a page once results are paginated — this fetches the full
// set for one doc id, independent of the current page/filters.
export const listRecordsByDocId = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listRecordsByDocIdSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    const supabase = getServiceSupabaseClient()

    let query = supabase.from('records').select('*').eq(data.field, data.value).order('id', { ascending: false })
    query = scopeToCaller(query, caller)

    const { data: rows, error } = await query
    if (error || !rows) return []
    return rows.map(toRecord)
  })

export const countAllRecords = createServerFn({ method: 'GET' }).handler(async () => {
  const caller = await requireAnySession()
  const supabase = getServiceSupabaseClient()

  let query = supabase.from('records').select('*', { count: 'exact', head: true })
  query = scopeToCaller(query, caller)

  const { count } = await query
  return count ?? 0
})

type IssuedDocumentResult = { ok: true; documentId: string; documentDate: string } | { ok: false; message: string }

// Postgres functions raise their user-facing (German) messages with
// errcode P0001; anything else is an unexpected failure.
function documentError(error: { code?: string; message: string } | null, fallback: string) {
  return { ok: false, message: error?.code === 'P0001' ? error.message : fallback } as const
}

// Invoice creation, cancellation and payment each run as one transaction in
// Postgres (see the atomic_document_workflow migration) — either every record
// of the document is updated or none is.
export const createInvoice = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createInvoiceSchema.parse(data))
  .handler(async ({ data, context }): Promise<IssuedDocumentResult> => {
    const { data: rows, error } = await context.supabase.rpc('create_invoice', { p_record_ids: data.recordIds })
    const row = rows?.[0]
    if (error || !row) return documentError(error, 'Die Rechnung konnte nicht erstellt werden.')
    return { ok: true, documentId: row.document_id, documentDate: row.document_date }
  })

export const cancelRecords = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => cancelRecordsSchema.parse(data))
  .handler(async ({ data, context }): Promise<IssuedDocumentResult> => {
    const { data: rows, error } = await context.supabase.rpc('cancel_records', { p_record_ids: data.recordIds })
    const row = rows?.[0]
    if (error || !row) return documentError(error, 'Die Stornierung ist fehlgeschlagen.')
    return { ok: true, documentId: row.document_id, documentDate: row.document_date }
  })

export const markInvoicesPaid = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => markInvoicesPaidSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('mark_invoices_paid', { p_invoice_ids: data.invoiceIds })
    if (error) return documentError(error, 'Die Rechnungen konnten nicht als bezahlt markiert werden.')
    return { ok: true } as const
  })
