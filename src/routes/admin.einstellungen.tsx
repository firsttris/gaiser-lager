import { createFileRoute, redirect } from '@tanstack/react-router'
import { ADMIN_PASSWORD_MIN_LENGTH, adminChangePassword, adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { formatGeneratedNumber, useAppState } from '../state/app-state'
import { Spinner } from '../components/spinner'
import { PinInput } from '../components/company-form-inputs'
import { InlineMessage } from '../components/toast'

export const Route = createFileRoute('/admin/einstellungen')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminEinstellungenPage,
})

const TOKEN_HINTS = [
  { token: '{JAHR}', description: 'Jahr, 4-stellig (z.B. 2026)' },
  { token: '{MONAT}', description: 'Monat, 2-stellig (z.B. 06)' },
  { token: '{TAG}', description: 'Tag, 2-stellig (z.B. 29)' },
  { token: '{NUMMER}', description: 'Laufende Nummer, mit Nullen aufgefüllt' },
]

function AdminEinstellungenPage() {
  const {
    numberingSettings,
    signupSettings,
    updateNumberingSettings,
    isUpdatingNumberingSettings,
    setMasterPin,
    isSettingMasterPin,
    updateInactivityTimeout,
    isUpdatingInactivityTimeout,
    downloadDatabaseBackup,
    isDownloadingBackup,
  } = useAppState()

  const [invoiceTemplate, setInvoiceTemplate] = useState(numberingSettings.invoiceTemplate)
  const [deliveryNoteTemplate, setDeliveryNoteTemplate] = useState(numberingSettings.deliveryNoteTemplate)
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(String(numberingSettings.nextInvoiceNumber))
  const [nextDeliveryNoteNumber, setNextDeliveryNoteNumber] = useState(String(numberingSettings.nextDeliveryNoteNumber))
  const [numberPadding, setNumberPadding] = useState(String(numberingSettings.numberPadding))
  const [customerNumberTemplate, setCustomerNumberTemplate] = useState(numberingSettings.customerNumberTemplate)
  const [nextCustomerNumber, setNextCustomerNumber] = useState(String(numberingSettings.nextCustomerNumber))
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [newMasterPin, setNewMasterPin] = useState('')
  const [masterPinMessage, setMasterPinMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState(String(signupSettings.inactivityTimeoutMinutes))
  const [adminInactivityTimeoutMinutes, setAdminInactivityTimeoutMinutes] = useState(
    String(signupSettings.adminInactivityTimeoutMinutes),
  )
  const [inactivityTimeoutMessage, setInactivityTimeoutMessage] = useState<{
    kind: 'success' | 'error'
    text: string
  } | null>(null)

  const [backupMessage, setBackupMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // numberingSettings loads asynchronously (Supabase query) after this
  // component's initial useState already ran with the placeholder default —
  // resync the form once the real values arrive.
  useEffect(() => {
    setInvoiceTemplate(numberingSettings.invoiceTemplate)
    setDeliveryNoteTemplate(numberingSettings.deliveryNoteTemplate)
    setNextInvoiceNumber(String(numberingSettings.nextInvoiceNumber))
    setNextDeliveryNoteNumber(String(numberingSettings.nextDeliveryNoteNumber))
    setNumberPadding(String(numberingSettings.numberPadding))
    setCustomerNumberTemplate(numberingSettings.customerNumberTemplate)
    setNextCustomerNumber(String(numberingSettings.nextCustomerNumber))
  }, [numberingSettings])

  useEffect(() => {
    setInactivityTimeoutMinutes(String(signupSettings.inactivityTimeoutMinutes))
    setAdminInactivityTimeoutMinutes(String(signupSettings.adminInactivityTimeoutMinutes))
  }, [signupSettings.inactivityTimeoutMinutes, signupSettings.adminInactivityTimeoutMinutes])

  const paddingValue = Math.max(Number(numberPadding) || 1, 1)
  const invoicePreview = formatGeneratedNumber(invoiceTemplate, Number(nextInvoiceNumber) || 0, paddingValue)
  const deliveryNotePreview = formatGeneratedNumber(deliveryNoteTemplate, Number(nextDeliveryNoteNumber) || 0, paddingValue)
  const customerNumberPreview = formatGeneratedNumber(customerNumberTemplate, Number(nextCustomerNumber) || 0, 1)
  const highestCustomerNumber = numberingSettings.highestCustomerNumber
  const nextCustomerNumberIsBelowHighest =
    highestCustomerNumber !== null && (Number(nextCustomerNumber) || 0) <= highestCustomerNumber

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await updateNumberingSettings({
      invoiceTemplate,
      deliveryNoteTemplate,
      nextInvoiceNumber: Math.max(Number(nextInvoiceNumber) || 1, 1),
      nextDeliveryNoteNumber: Math.max(Number(nextDeliveryNoteNumber) || 1, 1),
      numberPadding: paddingValue,
      customerNumberTemplate,
      nextCustomerNumber: Math.max(Number(nextCustomerNumber) || 1, 1),
    })

    if (!result.ok) {
      setMessage({ kind: 'error', text: result.message })
      return
    }

    setMessage({ kind: 'success', text: 'Einstellungen wurden gespeichert.' })
  }

  async function submitMasterPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await setMasterPin({ pin: newMasterPin })
    if (!result.ok) {
      setMasterPinMessage({ kind: 'error', text: result.message })
      return
    }

    setNewMasterPin('')
    setMasterPinMessage({ kind: 'success', text: 'Master-PIN wurde geändert.' })
  }

  async function submitInactivityTimeout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInactivityTimeoutMessage(null)

    const clampMinutes = (value: string) => Math.max(0, Math.min(240, Number(value) || 0))
    const minutes = clampMinutes(inactivityTimeoutMinutes)
    const adminMinutes = clampMinutes(adminInactivityTimeoutMinutes)

    const result = await updateInactivityTimeout({ customerMinutes: minutes, adminMinutes })
    if (!result.ok) {
      setInactivityTimeoutMessage({ kind: 'error', text: result.message })
      return
    }

    setInactivityTimeoutMinutes(String(minutes))
    setAdminInactivityTimeoutMinutes(String(adminMinutes))
    setInactivityTimeoutMessage({ kind: 'success', text: 'Inaktivitäts-Timeout wurde gespeichert.' })
  }

  async function downloadBackup() {
    setBackupMessage(null)
    const result = await downloadDatabaseBackup()
    if (!result.ok) {
      setBackupMessage({ kind: 'error', text: result.message })
      return
    }
    setBackupMessage({ kind: 'success', text: 'Backup wurde heruntergeladen.' })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="font-title text-4xl text-slate-900">Einstellungen</h2>
      <p className="mt-2 text-sm text-slate-600">
        Lege fest, wie Rechnungs- und Lieferscheinnummern automatisch generiert werden.
      </p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">Verfügbare Platzhalter</p>
        <ul className="mt-2 space-y-1">
          {TOKEN_HINTS.map(({ token, description }) => (
            <li key={token}>
              <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-800">{token}</code>{' '}
              {description}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Format Rechnungsnummer</label>
            <input
              value={invoiceTemplate}
              onChange={(e) => setInvoiceTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-800"
            />
            <p className="mt-1 text-xs text-slate-600">Vorschau: {invoicePreview}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Nächste Rechnungsnummer</label>
            <input
              type="number"
              min={1}
              value={nextInvoiceNumber}
              onChange={(e) => setNextInvoiceNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Format Lieferscheinnummer</label>
            <input
              value={deliveryNoteTemplate}
              onChange={(e) => setDeliveryNoteTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-800"
            />
            <p className="mt-1 text-xs text-slate-600">Vorschau: {deliveryNotePreview}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Nächste Lieferscheinnummer</label>
            <input
              type="number"
              min={1}
              value={nextDeliveryNoteNumber}
              onChange={(e) => setNextDeliveryNoteNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-700">Stellen der laufenden Nummer</label>
          <input
            type="number"
            min={1}
            max={10}
            value={numberPadding}
            onChange={(e) => setNumberPadding(e.target.value)}
            className="mt-2 w-32 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
          />
          <p className="mt-1 text-xs text-slate-600">Z.B. 4 ergibt 0001, 0002, ...</p>
        </div>

        <div className="space-y-4 md:col-span-2 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
          <div>
            <label className="text-sm font-semibold text-slate-700">Format Kundennummer</label>
            <input
              value={customerNumberTemplate}
              onChange={(e) => setCustomerNumberTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-800"
            />
            <p className="mt-1 text-xs text-slate-600">
              Vorschau: {customerNumberPreview}. Gilt, wenn beim Anlegen keine Kundennummer eingetragen wird, und bei
              der Selbstregistrierung. Bereits vergebene Nummern werden übersprungen.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Nächste Kundennummer</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={nextCustomerNumber}
              onChange={(e) => setNextCustomerNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
            {highestCustomerNumber !== null && (
              <p className={`mt-1 text-xs ${nextCustomerNumberIsBelowHighest ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>
                Höchste vergebene Kundennummer: {highestCustomerNumber}.
                {nextCustomerNumberIsBelowHighest && ' Die nächste Nummer liegt darunter – belegte Nummern werden übersprungen.'}
              </p>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isUpdatingNumberingSettings}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdatingNumberingSettings && <Spinner className="h-4 w-4" />}
            Speichern
          </button>
        </div>
      </form>

      <InlineMessage message={message} className="mt-4" />

      <AdminPasswordSection />

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-title text-2xl text-slate-900">Master-PIN für Kunden-Registrierung</h3>
        <p className="mt-2 text-sm text-slate-600">
          Neue Kunden benötigen diese PIN, um sich unter /registrieren selbst ein Konto anzulegen. Die aktuelle PIN
          wird aus Sicherheitsgründen nicht angezeigt.
        </p>

        <form onSubmit={submitMasterPin} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-40">
            <PinInput label="Neue Master-PIN" value={newMasterPin} onChange={setNewMasterPin} />
          </div>

          <button
            type="submit"
            disabled={isSettingMasterPin || !/^\d{4}$/.test(newMasterPin)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSettingMasterPin && <Spinner className="h-4 w-4" />}
            Master-PIN ändern
          </button>
        </form>

        <InlineMessage message={masterPinMessage} className="mt-4" />
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-title text-2xl text-slate-900">Automatischer Logout bei Inaktivität</h3>
        <p className="mt-2 text-sm text-slate-600">
          Nach dieser Zeit ohne Eingaben wird automatisch abgemeldet und die Startseite angezeigt. Der Wert für
          Kunden gilt auch für Mitarbeiter (Fahrer). Die letzten 30 Sekunden wird ein Countdown als Hinweis angezeigt.
          Wichtig am Kiosk-Tablet, das sich mehrere Personen teilen.
        </p>

        <form onSubmit={submitInactivityTimeout} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Kunden und Mitarbeiter (Minuten)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={inactivityTimeoutMinutes}
              onChange={(e) => setInactivityTimeoutMinutes(e.target.value)}
              className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Admin (Minuten)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={adminInactivityTimeoutMinutes}
              onChange={(e) => setAdminInactivityTimeoutMinutes(e.target.value)}
              className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingInactivityTimeout}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdatingInactivityTimeout && <Spinner className="h-4 w-4" />}
            Timeout speichern
          </button>
        </form>

        <p className="mt-1 text-xs text-slate-600">0 deaktiviert den automatischen Logout.</p>

        <InlineMessage message={inactivityTimeoutMessage} className="mt-4" />
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-title text-2xl text-slate-900">Datenbank-Backup</h3>
        <p className="mt-2 text-sm text-slate-600">
          Lädt einen SQL-Dump aller Daten (Kunden, Vorgänge, Produkte, LKWs, Einstellungen) als Datei herunter. Das
          Datenbankschema selbst ist im Projekt unter <code className="text-xs">supabase/migrations/</code> versioniert.
        </p>

        <button
          type="button"
          onClick={downloadBackup}
          disabled={isDownloadingBackup}
          className="mt-4 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDownloadingBackup && <Spinner className="h-4 w-4" />}
          SQL-Backup herunterladen
        </button>

        <InlineMessage message={backupMessage} className="mt-4" />
      </div>
    </section>
  )
}

const PASSWORD_INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800'

function AdminPasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const changePassword = useMutation({ mutationFn: adminChangePassword })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
      setMessage({ kind: 'error', text: `Das neue Passwort muss mindestens ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen haben.` })
      return
    }
    if (newPassword !== repeatPassword) {
      setMessage({ kind: 'error', text: 'Die beiden neuen Passwörter stimmen nicht überein.' })
      return
    }

    try {
      const result = await changePassword.mutateAsync({ data: { currentPassword, newPassword } })
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.message })
        return
      }
    } catch {
      setMessage({ kind: 'error', text: 'Passwort konnte nicht geändert werden.' })
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setRepeatPassword('')
    setMessage({ kind: 'success', text: 'Passwort wurde geändert. Andere Geräte wurden abgemeldet.' })
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="font-title text-2xl text-slate-900">Mein Passwort</h3>
      <p className="mt-2 text-sm text-slate-600">
        Ändert das Passwort des angemeldeten Admin-Kontos. Danach sind alle anderen Geräte mit diesem Konto abgemeldet.
      </p>

      <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Aktuelles Passwort
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={PASSWORD_INPUT_CLASS}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Neues Passwort
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={`mind. ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen`}
            className={PASSWORD_INPUT_CLASS}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Neues Passwort wiederholen
          <input
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            className={PASSWORD_INPUT_CLASS}
          />
        </label>
        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={changePassword.isPending || !currentPassword || !newPassword || !repeatPassword}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changePassword.isPending && <Spinner className="h-4 w-4" />}
            Passwort ändern
          </button>
        </div>
      </form>

      <InlineMessage message={message} className="mt-4" />
    </div>
  )
}
