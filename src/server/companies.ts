import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabaseBrowser } from '#/lib/supabase/browser-client'
import { requireAdminSession } from './middleware/require-admin-session'
import { generateCustomerNumber } from './customer-number.server'

export const PIN_HASH_ROUNDS = 12

export const priceCategorySchema = z.enum(['private', 'business'])

// Postgres unique_violation — the only unique constraint on companies that a
// user can hit is the customer number.
const UNIQUE_VIOLATION = '23505'

const createCompanySchema = z.object({
  name: z.string().min(1),
  customerNumber: z.string(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  pin: z.string().regex(/^\d{4}$/),
  priceCategory: priceCategorySchema,
})

const updateCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  customerNumber: z.string(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  priceCategory: priceCategorySchema,
})

const setCompanyPinSchema = z.object({
  companyId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
})

const deleteCompanySchema = z.object({ id: z.string().uuid() })

function toCompany(row: {
  id: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  price_category: 'private' | 'business'
}) {
  return {
    id: row.id,
    name: row.name,
    customerNumber: row.customer_number,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    priceCategory: row.price_category,
  }
}

export const adminListCompanies = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('companies')
      .select('id, name, customer_number, street, postal_code, city, price_category')
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
      price_category: data.priceCategory,
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
        price_category: data.priceCategory,
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

// Pre-login search box only ever needs id/name — the other Company
// fields are filled with empty placeholders so this still matches the shape
// consumed elsewhere in the app.
export const publicCompaniesQueryOptions = () =>
  queryOptions({
    queryKey: ['companies', 'public'] as const,
    queryFn: async () => {
      const { data, error } = await supabaseBrowser.from('companies_public').select('id, name')
      if (error || !data) return []
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        customerNumber: '',
        street: '',
        postalCode: '',
        city: '',
        priceCategory: 'business' as const,
      }))
    },
  })
