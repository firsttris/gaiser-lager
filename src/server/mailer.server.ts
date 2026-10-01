import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { createTransport } from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailSettingsRow } from '#/lib/supabase/types'
import { isDevelopmentDatabase } from '#/utils/environment'

// Against the local development database every mail goes to the Mailpit of
// the local Supabase (web UI: http://127.0.0.1:54324), never to a real
// server — even if real SMTP data was cloned from production.
export const DEV_MAILPIT = { host: '127.0.0.1', port: 54325, webUrl: 'http://127.0.0.1:54324' } as const
export const isMailpitOnly = isDevelopmentDatabase

// The SMTP password is stored encrypted (AES-256-GCM). The key is derived
// from SESSION_SECRET, so a database dump alone doesn't reveal it; changing
// SESSION_SECRET means entering the password again.
function encryptionKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return Buffer.from(hkdfSync('sha256', secret, 'gaiser-dashboard', 'smtp-password', 32))
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptSecret(stored: string): string | null {
  try {
    const [version, iv, tag, data] = stored.split(':')
    if (version !== 'v1') return null
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export async function loadEmailSettings(supabase: SupabaseClient): Promise<EmailSettingsRow> {
  const { data, error } = await supabase.from('email_settings').select('*').eq('id', true).single()
  if (error || !data) throw new Error('E-Mail-Einstellungen fehlen (Migration nicht eingespielt?).')
  return data as EmailSettingsRow
}

/** What is still missing before mails can be sent; empty = ready. */
export function emailSettingsProblems(settings: EmailSettingsRow): string[] {
  const problems: string[] = []
  if (!settings.from_address.trim()) problems.push('Absender-Adresse fehlt')
  if (isMailpitOnly) return problems
  if (!settings.smtp_host.trim()) problems.push('SMTP-Server fehlt')
  if (!settings.smtp_user.trim()) problems.push('SMTP-Benutzer fehlt')
  if (!settings.smtp_password_encrypted) problems.push('SMTP-Passwort fehlt')
  else if (decryptSecret(settings.smtp_password_encrypted) === null) {
    problems.push('SMTP-Passwort kann nicht entschlüsselt werden, bitte neu eingeben')
  }
  return problems
}

export type OutgoingMail = {
  to: string
  bcc?: string
  subject: string
  text: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}

export async function sendMail(settings: EmailSettingsRow, mail: OutgoingMail) {
  const problems = emailSettingsProblems(settings)
  if (problems.length) throw new Error(problems.join(', '))

  const transport = isMailpitOnly
    ? createTransport({ host: DEV_MAILPIT.host, port: DEV_MAILPIT.port, secure: false, ignoreTLS: true })
    : createTransport({
        host: settings.smtp_host.trim(),
        port: settings.smtp_port,
        secure: settings.smtp_security === 'tls',
        requireTLS: settings.smtp_security === 'starttls',
        auth: { user: settings.smtp_user.trim(), pass: decryptSecret(settings.smtp_password_encrypted ?? '') ?? '' },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      })

  try {
    const info = await transport.sendMail({
      from: { name: settings.from_name.trim(), address: settings.from_address.trim() },
      replyTo: settings.reply_to.trim() || undefined,
      to: mail.to,
      bcc: mail.bcc?.trim() || undefined,
      subject: mail.subject,
      text: mail.text,
      attachments: mail.attachments,
    })
    return { messageId: info.messageId as string }
  } finally {
    transport.close()
  }
}

// SMTP errors are technical; the admin gets a hint what to check.
export function describeMailError(error: unknown) {
  const err = error as { code?: string; responseCode?: number; message?: string }
  if (err.code === 'EAUTH' || err.responseCode === 535) return 'Anmeldung am SMTP-Server fehlgeschlagen (Benutzer/Passwort prüfen).'
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'EDNS') {
    return `SMTP-Server nicht erreichbar (Server, Port und Verschlüsselung prüfen). ${err.message ?? ''}`.trim()
  }
  if (err.code === 'EENVELOPE') return `Empfänger oder Absender abgelehnt: ${err.message ?? ''}`.trim()
  return err.message ?? 'Unbekannter Fehler beim Senden.'
}
