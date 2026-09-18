import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useEffect, useState } from 'react'
import { formatGeneratedNumber, useAppState } from '../state/app-state'
import { Spinner } from '../components/spinner'
import { PinInput } from '../components/company-form-inputs'

export const Route = createFileRoute('/admin/einstellungen')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/admin' })
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
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [newMasterPin, setNewMasterPin] = useState('')
  const [masterPinMessage, setMasterPinMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState(String(signupSettings.inactivityTimeoutMinutes))
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
  }, [numberingSettings])

  useEffect(() => {
    setInactivityTimeoutMinutes(String(signupSettings.inactivityTimeoutMinutes))
  }, [signupSettings.inactivityTimeoutMinutes])

  const paddingValue = Math.max(Number(numberPadding) || 1, 1)
  const invoicePreview = formatGeneratedNumber(invoiceTemplate, Number(nextInvoiceNumber) || 0, paddingValue)
  const deliveryNotePreview = formatGeneratedNumber(deliveryNoteTemplate, Number(nextDeliveryNoteNumber) || 0, paddingValue)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await updateNumberingSettings({
      invoiceTemplate,
      deliveryNoteTemplate,
      nextInvoiceNumber: Math.max(Number(nextInvoiceNumber) || 1, 1),
      nextDeliveryNoteNumber: Math.max(Number(nextDeliveryNoteNumber) || 1, 1),
      numberPadding: paddingValue,
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

    const minutes = Math.max(0, Math.min(240, Number(inactivityTimeoutMinutes) || 0))

    const result = await updateInactivityTimeout({ minutes })
    if (!result.ok) {
      setInactivityTimeoutMessage({ kind: 'error', text: result.message })
      return
    }

    setInactivityTimeoutMinutes(String(minutes))
    setInactivityTimeoutMessage({ kind: 'success', text: 'Inaktivitaets-Timeout wurde gespeichert.' })
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
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
            <p className="mt-1 text-xs text-slate-500">Vorschau: {invoicePreview}</p>
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
            <p className="mt-1 text-xs text-slate-500">Vorschau: {deliveryNotePreview}</p>
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
          <p className="mt-1 text-xs text-slate-500">Z.B. 4 ergibt 0001, 0002, ...</p>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isUpdatingNumberingSettings}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdatingNumberingSettings && <Spinner className="h-4 w-4" />}
            Speichern
          </button>
        </div>
      </form>

      {message && (
        <p
          className={`mt-4 rounded-xl p-3 text-sm ${
            message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </p>
      )}

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
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSettingMasterPin && <Spinner className="h-4 w-4" />}
            Master-PIN ändern
          </button>
        </form>

        {masterPinMessage && (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${
              masterPinMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {masterPinMessage.text}
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="font-title text-2xl text-slate-900">Automatischer Kunden-Logout bei Inaktivitaet</h3>
        <p className="mt-2 text-sm text-slate-600">
          Nach dieser Zeit ohne Eingaben wird der Kunde automatisch abgemeldet. Die letzten 30 Sekunden wird ein
          Countdown als Hinweis angezeigt.
        </p>

        <form onSubmit={submitInactivityTimeout} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Inaktivitaetszeit (Minuten)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={inactivityTimeoutMinutes}
              onChange={(e) => setInactivityTimeoutMinutes(e.target.value)}
              className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingInactivityTimeout}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdatingInactivityTimeout && <Spinner className="h-4 w-4" />}
            Timeout speichern
          </button>
        </form>

        <p className="mt-1 text-xs text-slate-500">0 deaktiviert den automatischen Logout.</p>

        {inactivityTimeoutMessage && (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${
              inactivityTimeoutMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {inactivityTimeoutMessage.text}
          </p>
        )}
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
          className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDownloadingBackup && <Spinner className="h-4 w-4" />}
          SQL-Backup herunterladen
        </button>

        {backupMessage && (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${
              backupMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {backupMessage.text}
          </p>
        )}
      </div>
    </section>
  )
}
