import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import { RENAMEABLE_RECORD_STATUSES } from './record-snapshots'
import type { ConstructionSiteRow } from '#/lib/supabase/types'

// Every construction site belongs to exactly one company (P3). The same
// address may exist for several companies, as separate sites.

const listSitesSchema = z.object({ companyId: z.string().uuid().optional() }).optional()
const createSiteSchema = z.object({ name: z.string(), companyId: z.string().uuid() })
const updateSiteSchema = z.object({ id: z.string().uuid(), name: z.string(), companyId: z.string().uuid() })
const deleteSiteSchema = z.object({ id: z.string().uuid() })

function toSite(row: Pick<ConstructionSiteRow, 'id' | 'name' | 'company_id'>) {
  return { id: row.id, name: row.name, companyId: row.company_id }
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

// LIKE treats % and _ as wildcards; site names are matched literally.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Customers only ever get their own company's sites. Employees and admins get
// the sites of the company given (suggestions in "Neuer Vorgang"); only admins
// may list all sites (Admin → Baustellen), including legacy ones without a
// company.
export const listConstructionSites = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listSitesSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    const companyId = caller.role === 'customer' ? caller.companyId : data?.companyId
    if (!companyId && caller.role !== 'admin') return []

    let query = getServiceSupabaseClient().from('construction_sites').select('id, name, company_id').order('name')
    if (companyId) query = query.eq('company_id', companyId)

    const { data: rows, error } = await query
    if (error || !rows) return []
    return rows.map(toSite)
  })

async function nameTakenForCompany(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  companyId: string,
  name: string,
  excludeId?: string,
) {
  let query = supabase
    .from('construction_sites')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', escapeLikePattern(name))
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.limit(1)
  return Boolean(data?.length)
}

export const adminCreateConstructionSite = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanedName = normalizeName(data.name)
    if (!cleanedName) {
      return { ok: false, message: 'Bitte Baustellenname ausfüllen.' } as const
    }

    if (await nameTakenForCompany(getServiceSupabaseClient(), data.companyId, cleanedName)) {
      return { ok: false, message: 'Diese Baustelle gibt es für diesen Kunden bereits.' } as const
    }

    const { error } = await context.supabase.from('construction_sites').insert({ name: cleanedName, company_id: data.companyId })
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
      .select('name, company_id')
      .eq('id', data.id)
      .maybeSingle()

    if (!currentSite) {
      return { ok: false, message: 'Die Baustelle wurde nicht gefunden.' } as const
    }

    const cleanedName = normalizeName(data.name)
    if (!cleanedName) {
      return { ok: false, message: 'Bitte Baustellenname ausfüllen.' } as const
    }

    const supabase = getServiceSupabaseClient()
    // A site that already has Vorgänge stays with its company.
    if (currentSite.company_id !== data.companyId) {
      const { count } = await supabase
        .from('records')
        .select('id', { count: 'exact', head: true })
        .eq('construction_site_id', data.id)
      if (count) {
        return { ok: false, message: 'Eine Baustelle mit Vorgängen kann keinem anderen Kunden zugeordnet werden.' } as const
      }
    }

    if (await nameTakenForCompany(supabase, data.companyId, cleanedName, data.id)) {
      return { ok: false, message: 'Diese Baustelle gibt es für diesen Kunden bereits.' } as const
    }

    const { error } = await context.supabase
      .from('construction_sites')
      .update({ name: cleanedName, company_id: data.companyId })
      .eq('id', data.id)
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

export const constructionSitesQueryOptions = (companyId?: string) =>
  queryOptions({
    queryKey: ['construction-sites', companyId ?? 'all'] as const,
    queryFn: () => listConstructionSites({ data: companyId ? { companyId } : undefined }),
  })

// Internal helper for record creation (src/server/records.ts): find the
// company's site by case-insensitive name or create it. Backed by the unique
// index on (company_id, lower(name)). Not exposed as a server function.
export async function findOrCreateConstructionSite(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  companyId: string,
  rawName: string,
) {
  const name = normalizeName(rawName)
  if (!name) return null

  const find = () =>
    supabase
      .from('construction_sites')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', escapeLikePattern(name))
      .limit(1)
      .maybeSingle()

  const { data: existing } = await find()
  if (existing) return existing

  const { data: created, error } = await supabase
    .from('construction_sites')
    .insert({ name, company_id: companyId })
    .select('id, name')
    .single()

  if (error || !created) {
    // Lost a race to a concurrent request creating the same site — re-read.
    const { data: raceWinner } = await find()
    return raceWinner ?? null
  }

  return created
}
