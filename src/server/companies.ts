import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { generateCustomerNumber } from './customer-number.server'

export const PIN_HASH_ROUNDS = 12

// Invoices will be e-mailed to this address. Required for new customers;
// existing customers without one can still be edited (empty = none yet).
export const companyEmailSchema = z.string().trim().pipe(z.email('Bitte eine gültige E-Mail-Adresse eingeben.'))
const optionalCompanyEmailSchema = z.union([z.literal(''), companyEmailSchema])

export const COMPANY_COLUMNS = 'id, name, customer_number, street, postal_code, city, email'

// Postgres unique_violation — the only unique constraint on companies that a
// user can hit is the customer number.
const UNIQUE_VIOLATION = '23505'

const createCompanySchema = z.object({
  name: z.string().min(1),
  customerNumber: z.string(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  email: companyEmailSchema,
  pin: z.string().regex(/^\d{4}$/),
})

const updateCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  customerNumber: z.string(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  email: optionalCompanyEmailSchema,
})

const setCompanyPinSchema = z.object({
  companyId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
})

const deleteCompanySchema = z.object({ id: z.string().uuid() })

export function toCompany(row: {
  id: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  email: string | null
}) {
  return {
    id: row.id,
    name: row.name,
    customerNumber: row.customer_number,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    email: row.email ?? '',
  }
}

export const adminListCompanies = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .order('name', { ascending: true })

    if (error || !data) return []
    return data.map(toCompany)
  })

export const adminCreateCompany = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const name = data.name.trim()

    const pinHash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)
    const customerNumber = data.customerNumber.trim() || (await generateCustomerNumber())

    const { error } = await context.supabase.from('companies').insert({
      name,
      customer_number: customerNumber,
      street: data.street.trim(),
      postal_code: data.postalCode.trim(),
      city: data.city.trim(),
      email: data.email,
      pin_hash: pinHash,
    })

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, message: 'Diese Kundennummer ist bereits vergeben.' } as const
      }
      return { ok: false, message: 'Der Kunde konnte nicht angelegt werden.' } as const
    }

    return { ok: true } as const
  })

export const adminUpdateCompany = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const name = data.name.trim()

    const { error } = await context.supabase
      .from('companies')
      .update({
        name,
        customer_number: data.customerNumber.trim(),
        street: data.street.trim(),
        postal_code: data.postalCode.trim(),
        city: data.city.trim(),
        email: data.email || null,
      })
      .eq('id', data.id)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, message: 'Diese Kundennummer ist bereits vergeben.' } as const
      }
      return { ok: false, message: 'Der Kunde konnte nicht aktualisiert werden.' } as const
    }

    return { ok: true } as const
  })

export const adminSetCompanyPin = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => setCompanyPinSchema.parse(data))
  .handler(async ({ data, context }) => {
    const pinHash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)

    const { error } = await context.supabase
      .from('companies')
      .update({ pin_hash: pinHash, failed_pin_attempts: 0, pin_locked_until: null, pin_changed_at: new Date().toISOString() })
      .eq('id', data.companyId)

    if (error) {
      return { ok: false, message: 'Die PIN konnte nicht geändert werden.' } as const
    }

    return { ok: true } as const
  })

export const adminDeleteCompany = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => deleteCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('companies').delete().eq('id', data.id)

    if (error) {
      return { ok: false, message: 'Die Firma konnte nicht gelöscht werden. Firmen mit Vorgängen können nicht gelöscht werden.' } as const
    }

    return { ok: true } as const
  })

export const adminCompaniesQueryOptions = () =>
  queryOptions({
    queryKey: ['companies', 'admin'] as const,
    queryFn: () => adminListCompanies(),
  })

export const COMPANY_SEARCH_MIN_CHARS = 2
const COMPANY_SEARCH_MAX_RESULTS = 8

const searchCompaniesSchema = z.object({ query: z.string().max(100) })

// LIKE treats % and _ as wildcards; a customer typing them should match them literally.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Company search for the customer login (no session required). Deliberately
// narrow so the customer list can't be browsed: nothing below the minimum
// length, few results, only id + name.
export const searchCompanies = createServerFn({ method: 'GET' })
  .validator((data: unknown) => searchCompaniesSchema.parse(data))
  .handler(async ({ data }) => {
    const query = data.query.trim()
    if (query.length < COMPANY_SEARCH_MIN_CHARS) return []

    const { data: rows, error } = await getServiceSupabaseClient()
      .from('companies')
      .select('id, name')
      .ilike('name', `%${escapeLikePattern(query)}%`)
      .order('name', { ascending: true })
      .limit(COMPANY_SEARCH_MAX_RESULTS)

    if (error || !rows) return []
    return rows
  })
