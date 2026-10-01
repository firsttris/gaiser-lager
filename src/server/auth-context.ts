import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getAdminSession, getCustomerSession } from './session'

export type CallerContext = { role: 'admin' } | { role: 'customer'; companyId: string }

// A customer session issued before the company's PIN was last changed is no
// longer valid — changing the PIN is how an admin locks out a leaked login.
export function isSessionOlderThanPinChange(loggedInAt: number | undefined, pinChangedAt: string | null) {
  if (!pinChangedAt) return false
  return (loggedInAt ?? 0) < new Date(pinChangedAt).getTime()
}

// Used by "dual-mode" server functions (products/trucks/construction-sites
// catalog reads, record creation) that any logged-in principal may call —
// admin or customer — but customers have no Supabase Auth identity to scope
// via RLS, so the caller's identity is resolved here and the calling
// function is responsible for scoping its own queries accordingly.
export async function requireAnySession(): Promise<CallerContext> {
  const adminSession = await getAdminSession()
  if (adminSession.data.userId) {
    return { role: 'admin' }
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
