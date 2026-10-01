import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import {
  DEV_MAILPIT,
  describeMailError,
  emailSettingsProblems,
  encryptSecret,
  isMailpitOnly,
  loadEmailSettings,
  sendMail,
} from './mailer.server'

const optionalEmail = z.union([z.literal(''), z.string().trim().email('Ungültige E-Mail-Adresse.')])

const updateEmailSettingsSchema = z.object({
  smtpHost: z.string().trim().max(200),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecurity: z.enum(['starttls', 'tls']),
  smtpUser: z.string().trim().max(200),
  /** Empty = keep the stored password. */
  smtpPassword: z.string().max(500),
  fromName: z.string().trim().min(1, 'Bitte einen Absender-Namen eingeben.').max(200),
  fromAddress: optionalEmail,
  replyTo: optionalEmail,
  bcc: optionalEmail,
  invoiceSubjectTemplate: z.string().trim().min(1, 'Bitte einen Betreff eingeben.').max(300),
  invoiceBodyTemplate: z.string().trim().min(1, 'Bitte einen Text eingeben.').max(10_000),
  cancellationSubjectTemplate: z.string().trim().min(1, 'Bitte einen Betreff für Stornorechnungen eingeben.').max(300),
  cancellationBodyTemplate: z.string().trim().min(1, 'Bitte einen Text für Stornorechnungen eingeben.').max(10_000),
})

export type EmailSettingsInput = z.infer<typeof updateEmailSettingsSchema>

export const adminGetEmailSettings = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async () => {
    const settings = await loadEmailSettings(getServiceSupabaseClient())
    return {
      smtpHost: settings.smtp_host,
      smtpPort: settings.smtp_port,
      smtpSecurity: settings.smtp_security,
      smtpUser: settings.smtp_user,
      hasPassword: Boolean(settings.smtp_password_encrypted),
      fromName: settings.from_name,
      fromAddress: settings.from_address,
      replyTo: settings.reply_to,
      bcc: settings.bcc,
      invoiceSubjectTemplate: settings.invoice_subject_template,
      invoiceBodyTemplate: settings.invoice_body_template,
      cancellationSubjectTemplate: settings.cancellation_subject_template,
      cancellationBodyTemplate: settings.cancellation_body_template,
      problems: emailSettingsProblems(settings),
      /** Local development: everything goes to Mailpit. */
      mailpitUrl: isMailpitOnly ? DEV_MAILPIT.webUrl : null,
    }
  })

export const emailSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ['email-settings'] as const,
    queryFn: () => adminGetEmailSettings(),
  })

export const adminUpdateEmailSettings = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => {
    const result = updateEmailSettingsSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? 'Ungültige Eingabe.' } as const
    return result.data
  })
  .handler(async ({ data }) => {
    if ('error' in data) return { ok: false, message: data.error } as const

    const { error } = await getServiceSupabaseClient()
      .from('email_settings')
      .update({
        smtp_host: data.smtpHost,
        smtp_port: data.smtpPort,
        smtp_security: data.smtpSecurity,
        smtp_user: data.smtpUser,
        ...(data.smtpPassword ? { smtp_password_encrypted: encryptSecret(data.smtpPassword) } : {}),
        from_name: data.fromName,
        from_address: data.fromAddress,
        reply_to: data.replyTo,
        bcc: data.bcc,
        invoice_subject_template: data.invoiceSubjectTemplate,
        invoice_body_template: data.invoiceBodyTemplate,
        cancellation_subject_template: data.cancellationSubjectTemplate,
        cancellation_body_template: data.cancellationBodyTemplate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    if (error) return { ok: false, message: 'Einstellungen konnten nicht gespeichert werden.' } as const
    return { ok: true } as const
  })

// Uses the saved settings, so "save, then test" checks exactly what invoices
// will be sent with.
export const adminSendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => z.object({ to: z.string().trim().email() }).parse(data))
  .handler(async ({ data }) => {
    const settings = await loadEmailSettings(getServiceSupabaseClient())
    try {
      await sendMail(settings, {
        to: data.to,
        subject: 'Testmail aus dem Gaiser-Dashboard',
        text:
          'Diese Testmail bestätigt, dass der E-Mail-Versand für Rechnungen funktioniert.\n\n' +
          `Server: ${isMailpitOnly ? `Mailpit (lokale Entwicklung)` : `${settings.smtp_host}:${settings.smtp_port}`}\n` +
          `Absender: ${settings.from_name} <${settings.from_address}>`,
      })
      return { ok: true, mailpitUrl: isMailpitOnly ? DEV_MAILPIT.webUrl : null } as const
    } catch (error) {
      return { ok: false, message: describeMailError(error) } as const
    }
  })
