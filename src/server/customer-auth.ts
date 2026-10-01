import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getCustomerSession, setCustomerSession, clearCustomerSession } from './session'
import { priceCategorySchema, PIN_HASH_ROUNDS } from './companies'
import { verifyMasterPin } from './master-pin.server'
import { generateCustomerNumber } from './customer-number.server'
import { isSessionOlderThanPinChange } from './auth-context'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const GENERIC_ERROR = { ok: false, message: 'Firma oder PIN ist ungültig.' } as const

const signInSchema = z.object({
  companyId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
})

const signUpSchema = z
  .object({
    masterPin: z.string().regex(/^\d{4}$/),
    name: z.string().min(1),
    street: z.string(),
    postalCode: z.string(),
    city: z.string(),
    priceCategory: priceCategorySchema,
    pin: z.string().regex(/^\d{4}$/),
    pinConfirmation: z.string().regex(/^\d{4}$/),
  })
  .refine((data) => data.pin === data.pinConfirmation, {
    message: 'Die PINs stimmen nicht überein.',
    path: ['pinConfirmation'],
  })

function toPublicCompany(company: {
  id: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  price_category: 'private' | 'business'
}) {
  return {
    id: company.id,
    name: company.name,
    customerNumber: company.customer_number,
    street: company.street,
    postalCode: company.postal_code,
    city: company.city,
    priceCategory: company.price_category,
  }
}

export const customerSignIn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, customer_number, street, postal_code, city, price_category, pin_hash')
      .eq('id', data.companyId)
      .maybeSingle()

    if (!company) {
      return GENERIC_ERROR
    }

    // Claims one attempt atomically *before* comparing, so concurrent
    // requests can't all slip past the lockout (see claim_company_pin_attempt).
    const { data: attemptAllowed } = await supabase.rpc('claim_company_pin_attempt', {
      p_company_id: company.id,
      p_max_attempts: MAX_ATTEMPTS,
      p_lock_minutes: LOCKOUT_MINUTES,
    })
    if (!attemptAllowed) {
      return { ok: false, message: `Zu viele Fehlversuche. Bitte in ${LOCKOUT_MINUTES} Minuten erneut versuchen.` } as const
    }

    const valid = await bcrypt.compare(data.pin, company.pin_hash)
    if (!valid) {
      return GENERIC_ERROR
    }

    await supabase.from('companies').update({ failed_pin_attempts: 0, pin_locked_until: null }).eq('id', company.id)
    await setCustomerSession({ companyId: company.id, loggedInAt: Date.now() })

    return { ok: true, company: toPublicCompany(company) } as const
  })

export const customerSignUp = createServerFn({ method: 'POST' })
  .validator((data: unknown) => signUpSchema.parse(data))
  .handler(async ({ data }) => {
    const masterPinCheck = await verifyMasterPin(data.masterPin)
    if (!masterPinCheck.ok) {
      return masterPinCheck
    }

    const supabase = getServiceSupabaseClient()
    const pinHash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)
    const customerNumber = await generateCustomerNumber()

    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name: data.name.trim(),
        customer_number: customerNumber,
        street: data.street.trim(),
        postal_code: data.postalCode.trim(),
        city: data.city.trim(),
        price_category: data.priceCategory,
        pin_hash: pinHash,
      })
      .select('id, name, customer_number, street, postal_code, city, price_category')
      .single()

    if (error || !company) {
      return { ok: false, message: 'Der Account konnte nicht angelegt werden.' } as const
    }

    await setCustomerSession({ companyId: company.id, loggedInAt: Date.now() })

    return { ok: true, company: toPublicCompany(company) } as const
  })

export const customerSignOut = createServerFn({ method: 'POST' }).handler(async () => {
  await clearCustomerSession()
  return { ok: true } as const
})

export const getCustomerSessionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getCustomerSession()
  if (!session.data.companyId) {
    return { isLoggedIn: false, company: null } as const
  }

  const supabase = getServiceSupabaseClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, customer_number, street, postal_code, city, price_category, pin_changed_at')
    .eq('id', session.data.companyId)
    .maybeSingle()

  if (!company || isSessionOlderThanPinChange(session.data.loggedInAt, company.pin_changed_at)) {
    return { isLoggedIn: false, company: null } as const
  }

  return { isLoggedIn: true, company: toPublicCompany(company) } as const
})

export const customerSessionStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'customer'] as const,
    queryFn: () => getCustomerSessionStatus(),
  })
