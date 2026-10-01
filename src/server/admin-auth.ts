import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getPublishableSupabaseClient, createAuthedSupabaseClient } from '#/lib/supabase/auth-client.server'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getAdminSession, setAdminSession, clearAdminSession } from './session'

const GENERIC_ERROR = { ok: false, message: 'E-Mail oder Passwort ist ungültig.' } as const

const adminSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const adminSignIn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => adminSignInSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getPublishableSupabaseClient()
    const { data: signIn, error } = await supabase.auth.signInWithPassword(data)

    if (error || !signIn.session || !signIn.user) {
      return GENERIC_ERROR
    }

    const authed = createAuthedSupabaseClient(signIn.session.access_token)
    const { data: adminRow } = await authed
      .from('admin_users')
      .select('user_id')
      .eq('user_id', signIn.user.id)
      .maybeSingle()

    if (!adminRow) {
      // Valid Supabase user, but not an admin: revoke the session we just
      // created instead of leaving a live token behind.
      try {
        await getServiceSupabaseClient().auth.admin.signOut(signIn.session.access_token, 'global')
      } catch {
        // Best-effort — no cookie gets set either way.
      }
      return GENERIC_ERROR
    }

    await setAdminSession({
      userId: signIn.user.id,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
      expiresAt: signIn.session.expires_at ?? 0,
    })

    return { ok: true } as const
  })

export const adminSignOut = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getAdminSession()

  if (session.data.accessToken) {
    try {
      await getServiceSupabaseClient().auth.admin.signOut(session.data.accessToken, 'global')
    } catch {
      // Best-effort revoke — clearing our own cookie below is what actually matters.
    }
  }

  await clearAdminSession()
  return { ok: true } as const
})

export const getAdminSessionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getAdminSession()
  return { isAdminLoggedIn: Boolean(session.data.userId) }
})

export const adminSessionStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'admin'] as const,
    queryFn: () => getAdminSessionStatus(),
  })
