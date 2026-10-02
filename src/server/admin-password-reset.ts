import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getPublishableSupabaseClient } from '#/lib/supabase/auth-client.server'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { isDevelopmentDatabase } from '#/utils/environment'
import { ADMIN_PASSWORD_MIN_LENGTH } from './admin-auth'
import { loadEmailSettings, sendMail } from './mailer.server'

// "Passwort vergessen" for admins. Supabase creates the one-time recovery
// token (valid 1 hour, see auth.email.otp_expiry); the mail goes out through
// our own SMTP settings, so no SMTP setup in the Supabase project is needed.

const MAX_REQUESTS_PER_ADDRESS_PER_HOUR = 3
const MAX_REQUESTS_PER_HOUR = 20

// Same answer whether or not the address belongs to an admin, so nobody can
// probe which addresses exist.
const NEUTRAL_ANSWER = {
  ok: true,
  message: 'Falls die Adresse zu einem Admin-Konto gehört, ist eine E-Mail mit einem Link unterwegs (1 Stunde gültig).',
} as const

// The link must point at our own app. Never built from the request's Host
// header in production: a forged Host would send the admin a link (with the
// token) to someone else's site.
function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (isDevelopmentDatabase) return getRequestUrl().origin
  return null
}

export const adminRequestPasswordReset = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ email: z.string().trim().toLowerCase().email() }).parse(data))
  .handler(async ({ data }) => {
    const service = getServiceSupabaseClient()
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    await service.from('password_reset_requests').delete().lt('requested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    const [{ count: forAddress }, { count: total }] = await Promise.all([
      service.from('password_reset_requests').select('id', { count: 'exact', head: true }).eq('email', data.email).gte('requested_at', hourAgo),
      service.from('password_reset_requests').select('id', { count: 'exact', head: true }).gte('requested_at', hourAgo),
    ])
    if ((forAddress ?? 0) >= MAX_REQUESTS_PER_ADDRESS_PER_HOUR || (total ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return { ok: false, message: 'Zu viele Anfragen. Bitte in einer Stunde erneut versuchen.' } as const
    }
    await service.from('password_reset_requests').insert({ email: data.email })

    const baseUrl = appBaseUrl()
    if (!baseUrl) {
      console.error('[password-reset] APP_URL is not set; cannot build the reset link.')
      return NEUTRAL_ANSWER
    }

    // Fails for unknown addresses — answered neutrally like everything else.
    const { data: link, error } = await service.auth.admin.generateLink({ type: 'recovery', email: data.email })
    if (error || !link.user || !link.properties?.hashed_token) return NEUTRAL_ANSWER

    const { data: adminRow } = await service.from('admin_users').select('user_id').eq('user_id', link.user.id).maybeSingle()
    if (!adminRow) return NEUTRAL_ANSWER

    const resetUrl = `${baseUrl}/passwort-neu?token=${encodeURIComponent(link.properties.hashed_token)}`
    try {
      const settings = await loadEmailSettings(service)
      await sendMail(settings, {
        to: data.email,
        subject: 'Gaiser-Dashboard: Passwort zurücksetzen',
        text:
          'Hallo,\n\n' +
          'für Ihr Admin-Konto im Gaiser-Dashboard wurde ein neues Passwort angefordert. ' +
          'Über diesen Link können Sie es innerhalb der nächsten Stunde festlegen:\n\n' +
          `${resetUrl}\n\n` +
          'Der Link funktioniert nur einmal. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail; ' +
          'Ihr bisheriges Passwort bleibt dann gültig.',
      })
    } catch (sendError) {
      console.error('[password-reset] sending failed:', (sendError as Error).message)
    }
    return NEUTRAL_ANSWER
  })

export const adminCompletePasswordReset = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({ token: z.string().min(10).max(500), password: z.string().min(ADMIN_PASSWORD_MIN_LENGTH).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const invalid = { ok: false, message: 'Der Link ist ungültig oder abgelaufen. Bitte neu anfordern.' } as const
    // Consumes the one-time token.
    const { data: verified, error } = await getPublishableSupabaseClient().auth.verifyOtp({
      token_hash: data.token,
      type: 'recovery',
    })
    if (error || !verified.user || !verified.session) return invalid

    const service = getServiceSupabaseClient()
    const { data: adminRow } = await service.from('admin_users').select('user_id').eq('user_id', verified.user.id).maybeSingle()
    if (!adminRow) return invalid

    const { error: updateError } = await service.auth.admin.updateUserById(verified.user.id, { password: data.password })
    if (updateError) return { ok: false, message: 'Passwort konnte nicht geändert werden.' } as const

    // Every existing login (including the one the token just created) ends.
    try {
      await service.auth.admin.signOut(verified.session.access_token, 'global')
    } catch {
      // Best-effort.
    }
    return { ok: true } as const
  })
