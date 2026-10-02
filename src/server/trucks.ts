import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import type { TruckRow } from '#/lib/supabase/types'
import { parsePriceInput } from '#/utils/money'
import { RENAMEABLE_RECORD_STATUSES } from './record-snapshots'

const createTruckSchema = z.object({
  name: z.string(),
  price: z.string(),
})

const updateTruckSchema = createTruckSchema.extend({ id: z.number() })
const deleteTruckSchema = z.object({ id: z.number() })

function toTruck(row: TruckRow) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
  }
}

export const listTrucks = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAnySession()

  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.from('trucks').select('*').order('id', { ascending: true })
  if (error || !data) return []
  return data.map(toTruck)
})

export const adminCreateTruck = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createTruckSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanedName = data.name.trim()
    if (!cleanedName) {
      return { ok: false, message: 'Bitte LKW-Bezeichnung ausfüllen.' } as const
    }

    const price = parsePriceInput(data.price)
    if (price === null) {
      return { ok: false, message: 'Der Preis muss eine gültige positive Zahl sein (z. B. 12,50).' } as const
    }

    const { error } = await context.supabase.from('trucks').insert({ name: cleanedName, price })

    if (error) {
      return { ok: false, message: 'Der LKW konnte nicht angelegt werden.' } as const
    }

    return { ok: true } as const
  })

export const adminUpdateTruck = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateTruckSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentTruck } = await context.supabase.from('trucks').select('name').eq('id', data.id).maybeSingle()
    if (!currentTruck) {
      return { ok: false, message: 'Der LKW wurde nicht gefunden.' } as const
    }

    const cleanedName = data.name.trim()
    if (!cleanedName) {
      return { ok: false, message: 'Bitte LKW-Bezeichnung ausfüllen.' } as const
    }

    const price = parsePriceInput(data.price)
    if (price === null) {
      return { ok: false, message: 'Der Preis muss eine gültige positive Zahl sein (z. B. 12,50).' } as const
    }

    const { error } = await context.supabase
      .from('trucks')
      .update({ name: cleanedName, price })
      .eq('id', data.id)

    if (error) {
      return { ok: false, message: 'Der LKW konnte nicht aktualisiert werden.' } as const
    }

    if (currentTruck.name !== cleanedName) {
      await context.supabase
        .from('records')
        .update({ product_name: cleanedName })
        .eq('type', 'lkw')
        .eq('product_name', currentTruck.name)
        .in('status', RENAMEABLE_RECORD_STATUSES)
    }

    return { ok: true } as const
  })

export const adminDeleteTruck = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => deleteTruckSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentTruck } = await context.supabase.from('trucks').select('name').eq('id', data.id).maybeSingle()
    if (!currentTruck) {
      return { ok: false, message: 'Der LKW wurde nicht gefunden.' } as const
    }

    const { count: historyCount } = await context.supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'lkw')
      .eq('product_name', currentTruck.name)

    if (historyCount && historyCount > 0) {
      return {
        ok: false,
        message: 'LKW kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
      } as const
    }

    const { count: truckCount } = await context.supabase.from('trucks').select('id', { count: 'exact', head: true })
    if (truckCount !== null && truckCount <= 1) {
      return { ok: false, message: 'Mindestens ein LKW muss vorhanden sein.' } as const
    }

    const { error } = await context.supabase.from('trucks').delete().eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Der LKW konnte nicht gelöscht werden.' } as const
    }

    return { ok: true } as const
  })

export const trucksQueryOptions = () =>
  queryOptions({
    queryKey: ['trucks'] as const,
    queryFn: () => listTrucks(),
  })
