import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { constructionSitesQueryOptions } from '../server/construction-sites'
import { useState } from 'react'
import { AutocompleteInput } from './autocomplete-input'
import { useAppState, type Company, type RecordItem } from '../state/app-state'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { Spinner } from './spinner'

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function TruckWizardFlow({
  company,
  onExit,
  vorgaengeTo,
}: {
  company: Company
  onExit: () => void
  vorgaengeTo: string
}) {
  const { trucks, createTruckRecord, isCreatingTruckRecord } = useAppState()
  const { data: constructionSites = [] } = useQuery(constructionSitesQueryOptions(company.id))

  const [step, setStep] = useState(1)
  const [isDownloadingNote, setIsDownloadingNote] = useState(false)
  const [selectedTruckId, setSelectedTruckId] = useState(() => trucks[0]?.id ?? 0)
  const [hours, setHours] = useState('')
  const [constructionSiteName, setConstructionSiteName] = useState('')
  const [successRecord, setSuccessRecord] = useState<{
    constructionSiteName: string
    truckName: string
    hours: number
    total: number
    record: RecordItem
  } | null>(null)

  const selectedTruck = trucks.find((t) => t.id === Number(selectedTruckId))
  const parsedHours = Number(hours)
  const validHours = Number.isFinite(parsedHours) && parsedHours > 0
  const validConstructionSiteName = constructionSiteName.trim().length > 0
  const currentHourlyPrice = selectedTruck?.price ?? 0
  const total = validHours ? parsedHours * currentHourlyPrice : 0

  async function submitRecord() {
    if (!selectedTruck || !validHours || !validConstructionSiteName) return

    const record = await createTruckRecord({
      truck: selectedTruck,
      hours: parsedHours,
      constructionSiteName,
      company,
    })
    if (!record) return

    setSuccessRecord({
      constructionSiteName: constructionSiteName.trim(),
      truckName: selectedTruck.name,
      hours: parsedHours,
      total,
      record,
    })
    setStep(3)
    setSelectedTruckId(trucks[0]?.id ?? 0)
    setHours('')
    setConstructionSiteName('')
  }

  async function redownloadDeliveryNote() {
    if (!successRecord) return
    setIsDownloadingNote(true)
    try {
      await downloadCombinedDeliveryNote([successRecord.record], company.name, successRecord.record.deliveryNoteId, company)
    } finally {
      setIsDownloadingNote(false)
    }
  }

  if (step === 1) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h3 className="font-title text-4xl text-slate-900">LKW und Stunden</h3>
        <p className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Kunde: <strong>{company.name}</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">LKW</label>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-amber-500"
            >
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Stunden</label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              inputMode="decimal"
              placeholder="z.B. 4.5"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
            />
          </div>

          <div className="sm:col-span-2">
            <AutocompleteInput
              label="Baustelle"
              value={constructionSiteName}
              onChange={setConstructionSiteName}
              options={constructionSites.map((site) => ({ id: site.id, label: site.name, badge: 'bekannt' }))}
              placeholder="z.B. Nordring 12, Berlin"
              required
              helperText="Neue Baustelle wird beim Anlegen dieses Vorgangs gespeichert."
              inputClassName="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          Stundenpreis: <strong>{money(currentHourlyPrice)}</strong> / Std. (netto)
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!validHours || !validConstructionSiteName}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Weiter zur Prüfung
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h3 className="font-title text-4xl text-slate-900">Vorgang prüfen</h3>
        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Typ</dt>
            <dd className="font-semibold">LKW-Stunden</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">LKW</dt>
            <dd className="font-semibold">{selectedTruck?.name}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Stunden</dt>
            <dd className="font-semibold">{hours} Std.</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Baustelle</dt>
            <dd className="font-semibold">{constructionSiteName.trim()}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Stundenpreis</dt>
            <dd className="font-semibold">
              {money(currentHourlyPrice)} (netto)
            </dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <dt className="text-amber-700">Gesamtsumme</dt>
            <dd className="text-lg font-bold text-amber-800">{money(total)}</dd>
          </div>
        </dl>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={submitRecord}
            disabled={!validHours || !validConstructionSiteName || isCreatingTruckRecord}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingTruckRecord && <Spinner className="h-4 w-4" />}
            Vorgang anlegen
          </button>
        </div>
      </div>
    )
  }

  if (step === 3 && successRecord) {
    return (
      <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg viewBox="0 0 20 20" className="h-6 w-6" aria-hidden="true">
              <path
                fill="currentColor"
                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.02 7.08a1 1 0 0 1-1.42.005L3.293 8.86a1 1 0 1 1 1.414-1.414l4.267 4.267 6.312-6.364a1 1 0 0 1 1.418-.058z"
              />
            </svg>
          </span>
          <div>
            <h3 className="font-title text-4xl text-slate-900">Vorgang erfolgreich angelegt</h3>
            <p className="text-slate-600">Der Lieferschein {successRecord.record.deliveryNoteId} wurde erstellt und kann jederzeit heruntergeladen werden.</p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">LKW</dt>
            <dd className="font-semibold">{successRecord.truckName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Baustelle</dt>
            <dd className="font-semibold">{successRecord.constructionSiteName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Stunden</dt>
            <dd className="font-semibold">{successRecord.hours} Std.</dd>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <dt className="text-emerald-700">Gesamtsumme</dt>
            <dd className="text-lg font-bold text-emerald-800">{money(successRecord.total)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void redownloadDeliveryNote()}
            disabled={isDownloadingNote}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingNote && <Spinner className="h-4 w-4" />}
            Lieferschein herunterladen
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Neuen Vorgang anlegen
          </button>
          <Link
            to={vorgaengeTo}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
          >
            Zu den Vorgängen
          </Link>
        </div>
      </div>
    )
  }

  return null
}
