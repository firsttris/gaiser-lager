import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getAdminSession, getCustomerSession, getEmployeeSession } from './session'

export type CallerContext =
  | { role: 'admin' }
  | { role: 'employee'; employeeId: string; employeeName: string }
  | { role: 'customer'; companyId: string }

// A session issued before the PIN was last changed is no longer valid —
// changing the PIN is how an admin locks out a leaked login.
export function isSessionOlderThanPinChange(loggedInAt: number | undefined, pinChangedAt: string | null) {
  if (!pinChangedAt) return false
  return (loggedInAt ?? 0) < new Date(pinChangedAt).getTime()
}

// Used by "dual-mode" server functions (catalog reads, record creation, …)
// that customers, employees and admins may call. Customers and employees have
// no Supabase Auth identity to scope via RLS, so the caller's identity is
// resolved here and the calling function scopes its own queries.
export async function requireAnySession(): Promise<CallerContext> {
  const adminSession = await getAdminSession()
  if (adminSession.data.userId) {
    return { role: 'admin' }
  }

  const employeeSession = await getEmployeeSession()
  const employeeId = employeeSession.data.employeeId
  if (employeeId) {
    const { data: employee } = await getServiceSupabaseClient()
      .from('employees')
      .select('name, active, pin_changed_at')
      .eq('id', employeeId)
      .maybeSingle()

    if (employee?.active && !isSessionOlderThanPinChange(employeeSession.data.loggedInAt, employee.pin_changed_at)) {
      return { role: 'employee', employeeId, employeeName: employee.name }
    }
  }

  const customerSession = await getCustomerSession()
  const companyId = customerSession.data.companyId
  if (companyId) {
    const { data: company } = await getServiceSupabaseClient()
      .from('companies')
      .select('pin_changed_at')
      .eq('id', companyId)
      .maybeSingle()

    if (company && !isSessionOlderThanPinChange(customerSession.data.loggedInAt, company.pin_changed_at)) {
      return { role: 'customer', companyId }
    }
  }

  throw new Error('UNAUTHENTICATED')
}
