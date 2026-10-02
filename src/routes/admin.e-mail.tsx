import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import {
  adminGetEmailSettings,
  adminSendTestEmail,
  adminUpdateEmailSettings,
  type EmailSettingsInput,
  emailSettingsQueryOptions,
} from '../server/email-settings'
import { Spinner } from '../components/spinner'
import { isValidEmail } from '../utils/email'
import {
  CANCELLATION_ONLY_TOKENS,
  fillTemplate,
  INVOICE_EMAIL_PLACEHOLDERS,
  SAMPLE_INVOICE_EMAIL_VALUES,
  unknownPlaceholders,
} from '../utils/email-template'
import { SelectInput } from '../components/select-input'
import { InlineMessage } from '../components/toast'

export const Route = createFileRoute('/admin/e-mail')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminEmailSettingsPage,
})

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-slate-800'
const LABEL_CLASS = 'block text-sm font-semibold text-slate-700'
type Message = { kind: 'success' | 'error'; text: string } | null

function MessageBox({ message }: { message: Message }) {
  return <InlineMessage message={message} className="mt-4" />
}

function AdminEmailSettingsPage() {
  const settingsQuery = useQuery(emailSettingsQueryOptions())

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="font-title text-4xl text-slate-900">E-Mail</h2>
      <p className="mt-2 text-sm text-slate-700">
        Zugangsdaten für den Versand von Rechnungen per E-Mail und die Vorlage für den Text. Das SMTP-Passwort wird
        verschlüsselt gespeichert und nie angezeigt.
      </p>
      {settingsQuery.data ? (
        <EmailSettingsForm initial={settingsQuery.data} />
      ) : (
        <div className="flex justify-center py-10">
          <Spinner className="h-8 w-8 text-slate-400" />
        </div>
      )}
    </section>
  )
}

type LoadedSettings = Awaited<ReturnType<typeof adminGetEmailSettings>>

function EmailSettingsForm({ initial }: { initial: LoadedSettings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EmailSettingsInput>({
    smtpHost: initial.smtpHost,
    smtpPort: initial.smtpPort,
    smtpSecurity: initial.smtpSecurity,
    smtpUser: initial.smtpUser,
    smtpPassword: '',
    fromName: initial.fromName,
    fromAddress: initial.fromAddress,
    replyTo: initial.replyTo,
    bcc: initial.bcc,
    invoiceSubjectTemplate: initial.invoiceSubjectTemplate,
    invoiceBodyTemplate: initial.invoiceBodyTemplate,
    cancellationSubjectTemplate: initial.cancellationSubjectTemplate,
    cancellationBodyTemplate: initial.cancellationBodyTemplate,
  })
  const [isDirty, setIsDirty] = useState(false)
  const [saveMessage, setSaveMessage] = useState<Message>(null)
  const [testAddress, setTestAddress] = useState('')
  const [testMessage, setTestMessage] = useState<Message>(null)

  const save = useMutation({
    mutationFn: adminUpdateEmailSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: emailSettingsQueryOptions().queryKey }),
  })
  const sendTest = useMutation({ mutationFn: adminSendTestEmail })

  function update<K extends keyof EmailSettingsInput>(key: K, value: EmailSettingsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setIsDirty(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveMessage(null)
    for (const [label, value] of [
      ['Absender-Adresse', form.fromAddress],
      ['Antwort an', form.replyTo],
      ['Kopie (BCC) an', form.bcc],
    ] as const) {
      if (value.trim() && !isValidEmail(value)) {
        setSaveMessage({ kind: 'error', text: `${label}: ungültige E-Mail-Adresse.` })
        return
      }
    }
    try {
      const result = await save.mutateAsync({ data: form })
      if (!result.ok) {
        setSaveMessage({ kind: 'error', text: result.message })
        return
      }
      setForm((current) => ({ ...current, smtpPassword: '' }))
      setIsDirty(false)
      setSaveMessage({ kind: 'success', text: 'E-Mail-Einstellungen wurden gespeichert.' })
    } catch {
      setSaveMessage({ kind: 'error', text: 'Einstellungen konnten nicht gespeichert werden.' })
    }
  }

  async function submitTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTestMessage(null)
    if (!isValidEmail(testAddress)) {
      setTestMessage({ kind: 'error', text: 'Bitte eine gültige E-Mail-Adresse eingeben.' })
      return
    }
    try {
      const result = await sendTest.mutateAsync({ data: { to: testAddress.trim() } })
      setTestMessage(
        result.ok
          ? {
              kind: 'success',
              text: result.mailpitUrl
                ? `Testmail gesendet – lokal zu sehen in Mailpit: ${result.mailpitUrl}`
                : `Testmail an ${testAddress.trim()} gesendet.`,
            }
          : { kind: 'error', text: result.message },
      )
    } catch {
      setTestMessage({ kind: 'error', text: 'Testmail konnte nicht gesendet werden.' })
    }
  }

  return (
    <>
      {initial.mailpitUrl && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Lokale Entwicklung: Es wird nichts wirklich verschickt. Alle Mails landen in Mailpit unter{' '}
          <a href={initial.mailpitUrl} target="_blank" rel="noreferrer" className="underline">
            {initial.mailpitUrl}
          </a>
          .
        </p>
      )}
      {initial.problems.length > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Noch nicht bereit:</span> {initial.problems.join(' · ')}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-8">
        <fieldset>
          <legend className="font-title text-2xl text-slate-900">Absender</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className={LABEL_CLASS}>
              Name
              <input value={form.fromName} onChange={(e) => update('fromName', e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Absender-Adresse
              <input
                type="email"
                value={form.fromAddress}
                onChange={(e) => update('fromAddress', e.target.value)}
                placeholder="rechnung@gaiser-abbruch.de"
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Antwort an (optional)
              <input
                type="email"
                value={form.replyTo}
                onChange={(e) => update('replyTo', e.target.value)}
                placeholder="info@gaiser-abbruch.de"
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Kopie (BCC) jeder Rechnungs-Mail an (optional)
              <input
                type="email"
                value={form.bcc}
                onChange={(e) => update('bcc', e.target.value)}
                placeholder="z.B. buchhaltung@gaiser-abbruch.de"
                className={INPUT_CLASS}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-title text-2xl text-slate-900">SMTP-Server</legend>
          <p className="mt-1 text-sm text-slate-700">Die Daten stehen beim Mail-Anbieter (z.B. IONOS, Strato, Microsoft 365).</p>
          <div className="mt-3 grid gap-4 md:grid-cols-4">
            <label className={`${LABEL_CLASS} md:col-span-2`}>
              Server
              <input
                value={form.smtpHost}
                onChange={(e) => update('smtpHost', e.target.value)}
                placeholder="z.B. smtp.ionos.de"
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Verschlüsselung
              <SelectInput
                value={form.smtpSecurity}
                onChange={(next) => {
                  const security = next as EmailSettingsInput['smtpSecurity']
                  update('smtpSecurity', security)
                  update('smtpPort', security === 'tls' ? 465 : 587)
                }}
                options={[
                  { value: 'starttls', label: 'STARTTLS (Port 587)' },
                  { value: 'tls', label: 'SSL/TLS (Port 465)' },
                ]}
                className={`${INPUT_CLASS} min-h-12`}
                label="Verschlüsselung"
              />
            </label>
            <label className={LABEL_CLASS}>
              Port
              <input
                type="number"
                min={1}
                max={65535}
                value={form.smtpPort}
                onChange={(e) => update('smtpPort', Number(e.target.value) || 0)}
                className={INPUT_CLASS}
              />
            </label>
            <label className={`${LABEL_CLASS} md:col-span-2`}>
              Benutzer
              <input
                value={form.smtpUser}
                autoComplete="off"
                onChange={(e) => update('smtpUser', e.target.value)}
                placeholder="meist die E-Mail-Adresse"
                className={INPUT_CLASS}
              />
            </label>
            <label className={`${LABEL_CLASS} md:col-span-2`}>
              Passwort
              <input
                type="password"
                autoComplete="new-password"
                value={form.smtpPassword}
                onChange={(e) => update('smtpPassword', e.target.value)}
                placeholder={initial.hasPassword ? 'gespeichert – leer lassen zum Behalten' : 'Passwort eingeben'}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        </fieldset>

        <TemplateEditor
          title="Vorlage Rechnungs-Mail"
          subject={form.invoiceSubjectTemplate}
          body={form.invoiceBodyTemplate}
          onSubjectChange={(value) => update('invoiceSubjectTemplate', value)}
          onBodyChange={(value) => update('invoiceBodyTemplate', value)}
          from={`${form.fromName} <${form.fromAddress || '…'}>`}
          bcc={form.bcc}
          attachment="rechnung-RG-20261001-0001.pdf (E-Rechnung, ZUGFeRD)"
        />

        <TemplateEditor
          title="Vorlage Stornorechnungs-Mail"
          isCancellation
          subject={form.cancellationSubjectTemplate}
          body={form.cancellationBodyTemplate}
          onSubjectChange={(value) => update('cancellationSubjectTemplate', value)}
          onBodyChange={(value) => update('cancellationBodyTemplate', value)}
          from={`${form.fromName} <${form.fromAddress || '…'}>`}
          bcc={form.bcc}
          attachment="storno-ST-20261005-17.pdf (E-Rechnung, ZUGFeRD)"
        />

        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending && <Spinner className="h-4 w-4" />}
          Speichern
        </button>
      </form>
      <MessageBox message={saveMessage} />

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-title text-2xl text-slate-900">Testmail</h3>
        <p className="mt-1 text-sm text-slate-700">Sendet eine kurze Mail mit den gespeicherten Einstellungen.</p>
        <form onSubmit={submitTest} className="mt-4 flex flex-wrap items-end gap-4">
          <label className={`${LABEL_CLASS} w-full max-w-sm`}>
            Empfänger
            <input
              type="email"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder="ihre@adresse.de"
              className={INPUT_CLASS}
            />
          </label>
          <button
            type="submit"
            disabled={sendTest.isPending || isDirty}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendTest.isPending && <Spinner className="h-4 w-4" />}
            Testmail senden
          </button>
          {isDirty && <p className="text-sm text-slate-700">Bitte zuerst speichern.</p>}
        </form>
        <MessageBox message={testMessage} />
      </div>
    </>
  )
}

// Subject + text with placeholder buttons (inserted at the cursor), typo
// warning and a live preview with sample values.
function TemplateEditor({
  title,
  isCancellation = false,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  from,
  bcc,
  attachment,
}: {
  title: string
  isCancellation?: boolean
  subject: string
  body: string
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  from: string
  bcc: string
  attachment: string
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const lastFocused = useRef<'subject' | 'body'>('body')
  const placeholders = INVOICE_EMAIL_PLACEHOLDERS.filter(
    (placeholder) => isCancellation || !CANCELLATION_ONLY_TOKENS.includes(placeholder.token),
  )
  const unknownTokens = unknownPlaceholders(`${subject}\n${body}`)
  const misplacedTokens = isCancellation ? [] : CANCELLATION_ONLY_TOKENS.filter((token) => `${subject}${body}`.includes(token))

  function insertPlaceholder(token: string) {
    const isSubject = lastFocused.current === 'subject'
    const target = isSubject ? subjectRef.current : bodyRef.current
    const value = isSubject ? subject : body
    const start = target?.selectionStart ?? value.length
    const end = target?.selectionEnd ?? value.length
    ;(isSubject ? onSubjectChange : onBodyChange)(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      target?.focus()
      target?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <fieldset>
      <legend className="font-title text-2xl text-slate-900">{title}</legend>
      <p className="mt-1 text-sm text-slate-700">
        Platzhalter antippen, um sie an der Cursor-Position einzufügen. Sie werden beim Versand für jede{' '}
        {isCancellation ? 'Stornorechnung' : 'Rechnung'} ersetzt.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {placeholders.map((placeholder) => (
          <button
            key={placeholder.token}
            type="button"
            onClick={() => insertPlaceholder(placeholder.token)}
            title={placeholder.description}
            className="min-h-11 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-semibold text-slate-800 hover:bg-slate-200"
          >
            {placeholder.token}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className={LABEL_CLASS}>
            Betreff
            <input
              ref={subjectRef}
              value={subject}
              onFocus={() => (lastFocused.current = 'subject')}
              onChange={(e) => onSubjectChange(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Text
            <textarea
              ref={bodyRef}
              value={body}
              onFocus={() => (lastFocused.current = 'body')}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={16}
              className={`${INPUT_CLASS} font-mono text-sm`}
            />
          </label>
          {unknownTokens.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Unbekannte Platzhalter (Tippfehler?): {unknownTokens.join(', ')}
            </p>
          )}
          {misplacedTokens.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {misplacedTokens.join(', ')} gibt es nur bei Stornorechnungen und bleibt hier leer.
            </p>
          )}
        </div>

        <div>
          <p className={LABEL_CLASS}>Vorschau (Beispiel)</p>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Von:</span> {from}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">An:</span> buchhaltung@muster-bau.example
              {bcc && <> · BCC: {bcc}</>}
            </p>
            <p className="mt-2 font-semibold text-slate-900">{fillTemplate(subject, SAMPLE_INVOICE_EMAIL_VALUES)}</p>
            <p className="mt-3 text-sm whitespace-pre-wrap text-slate-800">{fillTemplate(body, SAMPLE_INVOICE_EMAIL_VALUES)}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-sm text-slate-700">
              <Paperclip className="h-4 w-4" />
              {attachment}
            </p>
          </div>
        </div>
      </div>
    </fieldset>
  )
}
