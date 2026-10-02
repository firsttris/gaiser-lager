import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import { berlinDayEndExclusive, berlinDayStart, berlinIsoDate } from '#/utils/berlin-time'

// Photos of paper delivery notes (landfills etc.) a driver attaches while
// booking LKW-Stunden — always tied to that Vorgang. Private bucket; admins
// view them through short-lived signed URLs.
const BUCKET = 'delivery-note-photos'
// Photos are shrunk on the device to ~0.3–0.5 MB; this is the hard limit.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60

const uploadSchema = z.object({
  recordId: z.number().int().positive(),
  fileBase64: z.string(),
  contentType: z.enum(['image/jpeg', 'image/webp']),
})

// All photos of one Vorgang share a batch id derived from the record, so the
// inbox groups them even when they were sent in several attempts.
function batchIdForRecord(recordId: number) {
  return `00000000-0000-4000-8000-${recordId.toString(16).padStart(12, '0')}`
}

export const uploadDeliveryNotePhoto = createServerFn({ method: 'POST' })
  .validator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    if (caller.role !== 'employee') throw new Error('FORBIDDEN')

    const commaIndex = data.fileBase64.indexOf(',')
    const bytes = Buffer.from(commaIndex >= 0 ? data.fileBase64.slice(commaIndex + 1) : data.fileBase64, 'base64')
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
      return { ok: false, message: 'Das Foto ist zu groß oder leer.' } as const
    }

    const supabase = getServiceSupabaseClient()
    // Only for an LKW Vorgang this driver booked.
    const { data: record } = await supabase
      .from('records')
      .select('id, type, company_id, company_name, created_by_employee_id')
      .eq('id', data.recordId)
      .maybeSingle()
    if (!record || record.type !== 'lkw' || record.created_by_employee_id !== caller.employeeId) {
      return { ok: false, message: 'Lieferscheine können nur zu einem eigenen LKW-Vorgang hochgeladen werden.' } as const
    }
    const batchId = batchIdForRecord(record.id)

    const [year, month] = berlinIsoDate().split('-')
    const extension = data.contentType === 'image/webp' ? 'webp' : 'jpg'
    const path = `${year}/${month}/${batchId}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: data.contentType })
    if (uploadError) return { ok: false, message: 'Das Foto konnte nicht gespeichert werden.' } as const

    const { error } = await supabase.from('delivery_note_photos').insert({
      batch_id: batchId,
      record_id: record.id,
      storage_path: path,
      employee_id: caller.employeeId,
      employee_name: caller.employeeName,
      company_id: record.company_id,
      company_name: record.company_name,
    })
    if (error) {
      await supabase.storage.from(BUCKET).remove([path])
      return { ok: false, message: 'Das Foto konnte nicht gespeichert werden.' } as const
    }

    return { ok: true } as const
  })

const listSchema = z.object({
  status: z.enum(['open', 'done', 'all']),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type DeliveryNoteBatch = {
  batchId: string
  createdAt: string
  employeeName: string
  companyName: string | null
  note: string
  processedAt: string | null
  /** The LKW Vorgang (null for photos from before they were tied to one). */
  record: { deliveryNoteId: string | null; constructionSiteName: string; truckName: string; hours: number } | null
  photos: Array<{ id: string; url: string | null }>
}

// Inbox for the office: newest first, grouped by upload session (batch).
export const adminListDeliveryNotePhotos = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryNoteBatch[]> => {
    const supabase = getServiceSupabaseClient()
    let query = supabase.from('delivery_note_photos').select('*').order('created_at', { ascending: false }).limit(300)
    if (data.status === 'open') query = query.is('processed_at', null)
    if (data.status === 'done') query = query.not('processed_at', 'is', null)
    if (data.dateFrom) query = query.gte('created_at', berlinDayStart(data.dateFrom).toISOString())
    if (data.dateTo) query = query.lt('created_at', berlinDayEndExclusive(data.dateTo).toISOString())

    const { data: rows } = await query
    if (!rows?.length) return []

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_SECONDS,
    )
    const urlByPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]))

    const recordIds = [...new Set(rows.map((row) => row.record_id).filter((id): id is number => id !== null))]
    const { data: records } = recordIds.length
      ? await supabase.from('records').select('id, delivery_note_id, construction_site_name, product_name, amount').in('id', recordIds)
      : { data: [] }
    const recordById = new Map((records ?? []).map((record) => [record.id, record]))

    const batches = new Map<string, DeliveryNoteBatch>()
    for (const row of rows) {
      const batch =
        batches.get(row.batch_id) ??
        ({
          batchId: row.batch_id,
          createdAt: row.created_at,
          employeeName: row.employee_name ?? '—',
          companyName: row.company_name,
          note: row.note,
          processedAt: row.processed_at,
          record: (() => {
            const record = row.record_id !== null ? recordById.get(row.record_id) : undefined
            return record
              ? {
                  deliveryNoteId: record.delivery_note_id,
                  constructionSiteName: record.construction_site_name,
                  truckName: record.product_name,
                  hours: record.amount,
                }
              : null
          })(),
          photos: [],
        } satisfies DeliveryNoteBatch)
      batch.photos.push({ id: row.id, url: urlByPath.get(row.storage_path) ?? null })
      batches.set(row.batch_id, batch)
    }
    return [...batches.values()]
  })

export const deliveryNotePhotosQueryOptions = (filters: z.infer<typeof listSchema>) =>
  queryOptions({
    queryKey: ['delivery-note-photos', filters] as const,
    queryFn: () => adminListDeliveryNotePhotos({ data: filters }),
  })

const setProcessedSchema = z.object({ batchId: z.string().uuid(), processed: z.boolean() })

export const adminSetDeliveryNoteBatchProcessed = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => setProcessedSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('delivery_note_photos')
      .update({ processed_at: data.processed ? new Date().toISOString() : null })
      .eq('batch_id', data.batchId)
    if (error) return { ok: false, message: 'Der Status konnte nicht gespeichert werden.' } as const
    return { ok: true } as const
  })
