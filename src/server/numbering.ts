import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { requireAdminSession } from './middleware/require-admin-session'
import type { NumberingSettingsRow, Database } from '#/lib/supabase/types'

type NumberingSettingsUpdate = Database['public']['Tables']['numbering_settings']['Update']

const updateSettingsSchema = z.object({
  invoiceTemplate: z.string().optional(),
  deliveryNoteTemplate: z.string().optional(),
  nextInvoiceNumber: z.number().optional(),
  nextDeliveryNoteNumber: z.number().optional(),
  numberPadding: z.number().optional(),
})

function toSettings(row: NumberingSettingsRow) {
  return {
    invoiceTemplate: row.invoice_template,
    deliveryNoteTemplate: row.delivery_note_template,
    nextInvoiceNumber: row.next_invoice_number,
    nextDeliveryNoteNumber: row.next_delivery_note_number,
    numberPadding: row.number_padding,
  }
}

export const getNumberingSettings = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from('numbering_settings').select('*').eq('id', true).single()
    if (!data) {
      throw new Error('numbering_settings row is missing — were the migrations in supabase/migrations/ applied?')
    }
    return toSettings(data)
  })

export const updateNumberingSettings = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateSettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.invoiceTemplate !== undefined && !data.invoiceTemplate.trim()) {
      return { ok: false, message: 'Das Rechnungsnummer-Format darf nicht leer sein.' } as const
    }
    if (data.deliveryNoteTemplate !== undefined && !data.deliveryNoteTemplate.trim()) {
      return { ok: false, message: 'Das Lieferschein-Format darf nicht leer sein.' } as const
    }

    const update: NumberingSettingsUpdate = {}
    if (data.invoiceTemplate !== undefined) update.invoice_template = data.invoiceTemplate
    if (data.deliveryNoteTemplate !== undefined) update.delivery_note_template = data.deliveryNoteTemplate
    if (data.nextInvoiceNumber !== undefined) update.next_invoice_number = data.nextInvoiceNumber
    if (data.nextDeliveryNoteNumber !== undefined) update.next_delivery_note_number = data.nextDeliveryNoteNumber
    if (data.numberPadding !== undefined) update.number_padding = data.numberPadding

    const { error } = await context.supabase.from('numbering_settings').update(update).eq('id', true)
    if (error) {
      return { ok: false, message: 'Die Einstellungen konnten nicht gespeichert werden.' } as const
    }

    return { ok: true } as const
  })

export const numberingSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ['numbering-settings'] as const,
    queryFn: () => getNumberingSettings(),
  })
