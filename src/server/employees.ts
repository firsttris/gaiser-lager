import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAdminSession } from './middleware/require-admin-session'
import { PIN_HASH_ROUNDS } from './companies'

// Postgres unique_violation: the employee name is unique (case-insensitive).
const UNIQUE_VIOLATION = '23505'

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen eingeben.'),
  pin: z.string().regex(/^\d{4}$/, 'Die PIN muss 4-stellig sein.'),
})

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Bitte einen Namen eingeben.'),
  active: z.boolean(),
  /** Empty = keep the current PIN. */
  pin: z.union([z.literal(''), z.string().regex(/^\d{4}$/, 'Die PIN muss 4-stellig sein.')]),
})

export const adminListEmployees = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from('employees').select('id, name, active').order('active', { ascending: false }).order('name')
    return data ?? []
  })

export const adminEmployeesQueryOptions = () =>
  queryOptions({
    queryKey: ['employees'] as const,
    queryFn: () => adminListEmployees(),
  })

export const adminCreateEmployee = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createEmployeeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const pinHash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)
    const { error } = await context.supabase.from('employees').insert({ name: data.name, pin_hash: pinHash })
    if (error) {
      return {
        ok: false,
        message: error.code === UNIQUE_VIOLATION ? 'Diesen Namen gibt es bereits.' : 'Der Mitarbeiter konnte nicht angelegt werden.',
      } as const
    }
    return { ok: true } as const
  })

// No delete on purpose: deactivating keeps the "booked by" history intact.
export const adminUpdateEmployee = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateEmployeeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const update: { name: string; active: boolean; pin_hash?: string; pin_changed_at?: string; failed_pin_attempts?: number; pin_locked_until?: null } = {
      name: data.name,
      active: data.active,
    }
    if (data.pin) {
      update.pin_hash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)
      update.pin_changed_at = new Date().toISOString()
      update.failed_pin_attempts = 0
      update.pin_locked_until = null
    }

    const { error } = await context.supabase.from('employees').update(update).eq('id', data.id)
    if (error) {
      return {
        ok: false,
        message: error.code === UNIQUE_VIOLATION ? 'Diesen Namen gibt es bereits.' : 'Der Mitarbeiter konnte nicht gespeichert werden.',
      } as const
    }
    return { ok: true } as const
  })
