import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { clearEmployeeSession, getEmployeeSession, setEmployeeSession } from './session'
import { isSessionOlderThanPinChange } from './auth-context'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const GENERIC_ERROR = { ok: false, message: 'Name oder PIN ist ungültig.' } as const

const signInSchema = z.object({
  employeeId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
})

// Names for the driver login (no session yet). Only active employees, only
// id + name.
export const listEmployeeNames = createServerFn({ method: 'GET' }).handler(async () => {
  const { data } = await getServiceSupabaseClient()
    .from('employees')
    .select('id, name')
    .eq('active', true)
    .order('name')
  return data ?? []
})

export const employeeNamesQueryOptions = () =>
  queryOptions({
    queryKey: ['employee-names'] as const,
    queryFn: () => listEmployeeNames(),
  })

export const employeeSignIn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('id, name, pin_hash, active')
      .eq('id', data.employeeId)
      .maybeSingle()

    if (!employee?.active) return GENERIC_ERROR

    // Claim an attempt atomically before comparing (see claim_company_pin_attempt).
    const { data: attemptAllowed } = await supabase.rpc('claim_employee_pin_attempt', {
      p_employee_id: employee.id,
      p_max_attempts: MAX_ATTEMPTS,
      p_lock_minutes: LOCKOUT_MINUTES,
    })
    if (!attemptAllowed) {
      return { ok: false, message: `Zu viele Fehlversuche. Bitte in ${LOCKOUT_MINUTES} Minuten erneut versuchen.` } as const
    }

    if (!(await bcrypt.compare(data.pin, employee.pin_hash))) return GENERIC_ERROR

    await supabase.from('employees').update({ failed_pin_attempts: 0, pin_locked_until: null }).eq('id', employee.id)
    await setEmployeeSession({ employeeId: employee.id, loggedInAt: Date.now() })
    return { ok: true } as const
  })

export const employeeSignOut = createServerFn({ method: 'POST' }).handler(async () => {
  await clearEmployeeSession()
  return { ok: true } as const
})

export const getEmployeeSessionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getEmployeeSession()
  if (!session.data.employeeId) return { isLoggedIn: false, employee: null } as const

  const { data: employee } = await getServiceSupabaseClient()
    .from('employees')
    .select('id, name, active, pin_changed_at')
    .eq('id', session.data.employeeId)
    .maybeSingle()

  if (!employee?.active || isSessionOlderThanPinChange(session.data.loggedInAt, employee.pin_changed_at)) {
    return { isLoggedIn: false, employee: null } as const
  }
  return { isLoggedIn: true, employee: { id: employee.id, name: employee.name } } as const
})

export const employeeSessionStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'employee'] as const,
    queryFn: () => getEmployeeSessionStatus(),
  })
