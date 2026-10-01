import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import type { ConstructionSiteRow } from '#/lib/supabase/types'
import { RENAMEABLE_RECORD_STATUSES } from './record-snapshots'

const createSiteSchema = z.object({ name: z.string() })
const updateSiteSchema = z.object({ id: z.string().uuid(), name: z.string() })
const deleteSiteSchema = z.object({ id: z.string().uuid() })

function toSite(row: ConstructionSiteRow) {
  return { id: row.id, name: row.name }
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export const listConstructionSites = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAnySession()

  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.from('construction_sites').select('*').order('name', { ascending: true })
  if (error || !data) return []
  return data.map(toSite)
})

export const adminCreateConstructionSite = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanedName = normalizeName(data.name)
    if (!cleanedName) {
      return { ok: false, message: 'Bitte Baustellenname ausfüllen.' } as const
    }

    const { data: existing } = await context.supabase
      .from('construction_sites')
      .select('id')
      .ilike('name', cleanedName)
      .maybeSingle()

    if (existing) {
      return { ok: false, message: 'Diese Baustelle existiert bereits.' } as const
    }

    const { error } = await context.supabase.from('construction_sites').insert({ name: cleanedName })
    if (error) {
      return { ok: false, message: 'Die Baustelle konnte nicht angelegt werden.' } as const
    }

    return { ok: true } as const
  })

export const adminUpdateConstructionSite = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentSite } = await context.supabase
      .from('construction_sites')
      .select('name')
      .eq('id', data.id)
      .maybeSingle()

    if (!currentSite) {
      return { ok: false, message: 'Die Baustelle wurde nicht gefunden.' } as const
    }

    const cleanedName = normalizeName(data.name)
    if (!cleanedName) {
      return { ok: false, message: 'Bitte Baustellenname ausfüllen.' } as const
    }

    const { data: existing } = await context.supabase
      .from('construction_sites')
      .select('id')
      .ilike('name', cleanedName)
      .neq('id', data.id)
      .maybeSingle()

    if (existing) {
      return { ok: false, message: 'Diese Baustelle existiert bereits.' } as const
    }

    const { error } = await context.supabase.from('construction_sites').update({ name: cleanedName }).eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Die Baustelle konnte nicht aktualisiert werden.' } as const
    }

    if (currentSite.name !== cleanedName) {
      await context.supabase
        .from('records')
        .update({ construction_site_name: cleanedName })
        .eq('construction_site_id', data.id)
        .in('status', RENAMEABLE_RECORD_STATUSES)
    }

    return { ok: true } as const
  })

export const adminDeleteConstructionSite = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => deleteSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { count: historyCount } = await context.supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('construction_site_id', data.id)

    if (historyCount && historyCount > 0) {
      return {
        ok: false,
        message: 'Baustelle kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
      } as const
    }

    const { error } = await context.supabase.from('construction_sites').delete().eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Die Baustelle konnte nicht gelöscht werden.' } as const
    }

    return { ok: true } as const
  })

export const constructionSitesQueryOptions = () =>
  queryOptions({
    queryKey: ['construction-sites'] as const,
    queryFn: () => listConstructionSites(),
  })

// Internal helper for record creation (src/server/records.ts) — atomic
// find-or-create by case-insensitive name, backed by the unique index on
// lower(name). Not exposed as a server function; only called service-role-side
// from within another server function's handler.
export async function findOrCreateConstructionSite(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  rawName: string,
) {
  const name = normalizeName(rawName)
  if (!name) return null

  const { data: existing } = await supabase.from('construction_sites').select('id, name').ilike('name', name).maybeSingle()
  if (existing) return existing

  const { data: created, error } = await supabase
    .from('construction_sites')
    .insert({ name })
    .select('id, name')
    .single()

  if (error || !created) {
    // Lost a race to another concurrent request inserting the same name —
    // the unique index on lower(name) rejected our insert. Re-read.
    const { data: raceWinner } = await supabase.from('construction_sites').select('id, name').ilike('name', name).maybeSingle()
    return raceWinner ?? null
  }

  return created
}
