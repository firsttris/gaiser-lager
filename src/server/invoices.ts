import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAnySession } from './auth-context'
import { toRecord } from './records'
import { lastSentAtByInvoice } from './invoice-email'
import { berlinDayEndExclusive, berlinDayStart } from '#/utils/berlin-time'

const listInvoiceGroupsPageSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(200),
  companyId: z.string().uuid().optional(),
  status: z.enum(['offen', 'bezahlt', 'storniert']).optional(),
  search: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// UI-facing filter values ('offen') vs. the raw records.status the
// invoice_groups view groups by ('rechnung') — see the migration comment
// for why status is a plain grouped column rather than a computed one.
const STATUS_FILTER_TO_RECORD_STATUS = {
  offen: 'rechnung',
  bezahlt: 'bezahlt',
  storniert: 'storniert',
} as const

export const listInvoiceGroupsPage = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listInvoiceGroupsPageSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    // Invoices are for the office and the customer, not for drivers.
    if (caller.role === 'employee') return { groups: [], totalCount: 0, emailedAt: {} as Record<string, string> }
    const supabase = getServiceSupabaseClient()

    let query = supabase.from('invoice_groups').select('*', { count: 'exact' })
    query = caller.role === 'admin' ? query : query.eq('company_id', caller.companyId)
    if (caller.role === 'admin' && data.companyId) query = query.eq('company_id', data.companyId)
    if (data.status) query = query.eq('status', STATUS_FILTER_TO_RECORD_STATUS[data.status])
    if (data.search) query = query.ilike('invoice_id', `%${data.search.trim()}%`)
    if (data.dateFrom) query = query.gte('created_at', berlinDayStart(data.dateFrom).toISOString())
    if (data.dateTo) query = query.lt('created_at', berlinDayEndExclusive(data.dateTo).toISOString())

    const from = (data.page - 1) * data.pageSize
    const { data: groupRows, error, count } = await query
      .order('invoice_id', { ascending: false })
      .range(from, from + data.pageSize - 1)

    if (error || !groupRows || groupRows.length === 0) {
      return { groups: [], totalCount: count ?? 0, emailedAt: {} as Record<string, string> }
    }

    const invoiceIds = groupRows.map((g) => g.invoice_id)
    const { data: itemRows } = await supabase
      .from('records')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('id', { ascending: false })

    const itemsByInvoice = new Map<string, ReturnType<typeof toRecord>[]>()
    for (const row of itemRows ?? []) {
      const list = itemsByInvoice.get(row.invoice_id!) ?? []
      list.push(toRecord(row))
      itemsByInvoice.set(row.invoice_id!, list)
    }

    // When the invoice was last e-mailed (only the office sees that).
    const sentAt = caller.role === 'admin' ? await lastSentAtByInvoice(supabase, invoiceIds) : new Map<string, string>()
    const groups = groupRows.map((g) => ({ id: g.invoice_id, items: itemsByInvoice.get(g.invoice_id) ?? [] }))
    return { groups, totalCount: count ?? 0, emailedAt: Object.fromEntries(sentAt) as Record<string, string> }
  })

export const countAllInvoiceGroups = createServerFn({ method: 'GET' }).handler(async () => {
  const caller = await requireAnySession()
  if (caller.role === 'employee') return 0
  const supabase = getServiceSupabaseClient()

  let query = supabase.from('invoice_groups').select('invoice_id', { count: 'exact', head: true })
  query = caller.role === 'admin' ? query : query.eq('company_id', caller.companyId)

  const { count } = await query
  return count ?? 0
})
