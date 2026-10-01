import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import { berlinDayEndExclusive, berlinDayStart, berlinIsoDate } from '#/utils/berlin-time'

// Photos of paper delivery notes the drivers bring back (landfills etc.).
// Private bucket; admins view them through short-lived signed URLs.
const BUCKET = 'delivery-note-photos'
// Photos are shrunk on the device to ~0.3–0.5 MB; this is the hard limit.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60

const uploadSchema = z.object({
  batchId: z.string().uuid(),
  fileBase64: z.string(),
  contentType: z.enum(['image/jpeg', 'image/webp']),
  companyId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
})

export const uploadDeliveryNotePhoto = createServerFn({ method: 'POST' })
  .validator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    if (caller.role === 'customer') throw new Error('FORBIDDEN')

    const commaIndex = data.fileBase64.indexOf(',')
    const bytes = Buffer.from(commaIndex >= 0 ? data.fileBase64.slice(commaIndex + 1) : data.fileBase64, 'base64')
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
      return { ok: false, message: 'Das Foto ist zu groß oder leer.' } as const
    }

    const supabase = getServiceSupabaseClient()
    let companyName: string | null = null
    if (data.companyId) {
      const { data: company } = await supabase.from('companies').select('name').eq('id', data.companyId).maybeSingle()
      companyName = company?.name ?? null
    }

    const [year, month] = berlinIsoDate().split('-')
    const extension = data.contentType === 'image/webp' ? 'webp' : 'jpg'
    const path = `${year}/${month}/${data.batchId}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: data.contentType })
    if (uploadError) return { ok: false, message: 'Das Foto konnte nicht gespeichert werden.' } as const

    const { error } = await supabase.from('delivery_note_photos').insert({
      batch_id: data.batchId,
      storage_path: path,
      employee_id: caller.role === 'employee' ? caller.employeeId : null,
      employee_name: caller.role === 'employee' ? caller.employeeName : 'Büro',
      company_id: data.companyId ?? null,
      company_name: companyName,
      note: data.note?.trim() ?? '',
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
