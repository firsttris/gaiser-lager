import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getPublishableSupabaseClient, createAuthedSupabaseClient } from '#/lib/supabase/auth-client.server'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getAdminSession, setAdminSession, clearAdminSession } from './session'
import { requireAdminSession } from './middleware/require-admin-session'

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

export const ADMIN_PASSWORD_MIN_LENGTH = 10

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(ADMIN_PASSWORD_MIN_LENGTH),
})

export const adminChangePassword = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => changePasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const service = getServiceSupabaseClient()
    const { data: user } = await service.auth.admin.getUserById(context.adminUserId)
    const email = user.user?.email
    if (!email) return { ok: false, message: 'Konto nicht gefunden.' } as const

    // Proves the current password; the extra session is revoked right after.
    const { data: check, error: checkError } = await getPublishableSupabaseClient().auth.signInWithPassword({
      email,
      password: data.currentPassword,
    })
    if (checkError || !check.session) return { ok: false, message: 'Das aktuelle Passwort ist falsch.' } as const
    try {
      await service.auth.admin.signOut(check.session.access_token, 'local')
    } catch {
      // Best-effort.
    }

    if (data.currentPassword === data.newPassword) {
      return { ok: false, message: 'Das neue Passwort muss sich vom aktuellen unterscheiden.' } as const
    }

    const { error } = await service.auth.admin.updateUserById(context.adminUserId, { password: data.newPassword })
    if (error) return { ok: false, message: 'Passwort konnte nicht geändert werden.' } as const

    // Sign out every other device that still uses the old password.
    const session = await getAdminSession()
    if (session.data.accessToken) {
      try {
        await service.auth.admin.signOut(session.data.accessToken, 'others')
      } catch {
        // Best-effort.
      }
    }

    return { ok: true } as const
  })
