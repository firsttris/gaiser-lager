import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAnySession } from './auth-context'
import { berlinIsoDate } from '#/utils/berlin-time'

// Photos of paper delivery notes (landfills etc.) a driver attaches while
// booking LKW-Stunden — always tied to that Vorgang. Private bucket; admins
// view them at the Vorgang ("Fotos" in the Dateien column) through short-lived
// signed URLs.
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

export type RecordPhoto = { id: string; url: string | null; createdAt: string }

// The photos of one Vorgang, opened from its "Fotos" button in the lists:
// admins for every Vorgang, drivers only for the ones they booked.
export const listRecordPhotos = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ recordId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }): Promise<RecordPhoto[]> => {
    const caller = await requireAnySession()
    if (caller.role === 'customer') throw new Error('FORBIDDEN')

    const supabase = getServiceSupabaseClient()
    if (caller.role === 'employee') {
      const { data: record } = await supabase.from('records').select('created_by_employee_id').eq('id', data.recordId).maybeSingle()
      if (record?.created_by_employee_id !== caller.employeeId) throw new Error('FORBIDDEN')
    }

    const { data: rows } = await supabase
      .from('delivery_note_photos')
      .select('id, storage_path, created_at')
      .eq('record_id', data.recordId)
      .order('created_at')
    if (!rows?.length) return []

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_SECONDS,
    )
    const urlByPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]))
    return rows.map((row) => ({ id: row.id, url: urlByPath.get(row.storage_path) ?? null, createdAt: row.created_at }))
  })
