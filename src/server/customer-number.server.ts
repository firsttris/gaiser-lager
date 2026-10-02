import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'

// Plain helper (not a createServerFn) called from adminCreateCompany's and
// customerSignUp's own handlers to assign a customer number at creation
// time. Format and next number are configured in Settings → Nummernkreise;
// numbers already given out by hand are skipped (next_free_customer_number).
// Lives in its own .server.ts file — it isn't imported by any client-visible
// module, so this file's service-client.server import can't leak into the
// client bundle.
export async function generateCustomerNumber(): Promise<string> {
  const { data, error } = await getServiceSupabaseClient().rpc('next_free_customer_number')
  if (error || !data) {
    throw new Error('Kundennummer konnte nicht erzeugt werden.')
  }
  return data
}
