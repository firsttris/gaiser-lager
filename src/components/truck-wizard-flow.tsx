import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { constructionSitesQueryOptions } from '../server/construction-sites'
import { recentBookingsQueryOptions, type RecentBooking } from '../server/records'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState, type Company, type RecordItem } from '../state/app-state'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { Spinner } from './spinner'
import { formatAmount } from './amount-dialog'
import {
  BookingSummary,
  ChoiceButtons,
  LastBookingButton,
  QuickAmountPicker,
  SitePicker,
  buildQuickAmounts,
  currentSiteName,
  money,
  orderSiteNames,
} from './booking-pickers'
import { DeliveryNotePhotoPicker, type PendingPhoto, releasePendingPhotos } from './delivery-note-photo-picker'
import { uploadDeliveryNotePhoto } from '../server/delivery-note-photos'
import { blobToDataUrl } from '../utils/shrink-image'

// Half a day and a full day are the usual truck bookings.
const DEFAULT_QUICK_HOURS = [1, 2, 4, 6, 8]

export function TruckWizardFlow({
  company,
  onExit,
  vorgaengeTo,
  withDeliveryNotePhotos = false,
}: {
  company: Company
  onExit: () => void
  vorgaengeTo: string
  /** Drivers attach photos of the paper delivery notes (landfill etc.). */
  withDeliveryNotePhotos?: boolean
}) {
  const { trucks, createTruckRecord, isCreatingTruckRecord } = useAppState()
  const { data: constructionSites = [] } = useQuery(constructionSitesQueryOptions(company.id))
  const { data: recentBookings = [] } = useQuery(recentBookingsQueryOptions(company.id))

  const [step, setStep] = useState<'form' | 'success'>('form')
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
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [photoUpload, setPhotoUpload] = useState<{ sent: number; failed: PendingPhoto[]; error: string } | null>(null)
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  // Free the preview images when the wizard closes.
  const photosRef = useRef<PendingPhoto[]>([])
  photosRef.current = [...photos, ...(photoUpload?.failed ?? [])]
  useEffect(() => () => releasePendingPhotos(photosRef.current), [])

  const selectedTruck = trucks.find((t) => t.id === Number(selectedTruckId))
  const parsedHours = Number(hours)
  const validHours = Number.isFinite(parsedHours) && parsedHours > 0
  const validConstructionSiteName = constructionSiteName.trim().length > 0
  const currentHourlyPrice = selectedTruck?.price ?? 0
  const total = validHours ? parsedHours * currentHourlyPrice : 0
  const isComplete = Boolean(selectedTruck) && validHours && validConstructionSiteName

  const truckBookings = useMemo(() => recentBookings.filter((booking) => booking.type === 'lkw'), [recentBookings])
  // "Wie zuletzt" only for a truck that is still on offer.
  const lastBooking = truckBookings.find((booking) => trucks.some((truck) => truck.name === booking.productName))
  const quickHours = useMemo(
    () => buildQuickAmounts(truckBookings.filter((b) => b.productName === selectedTruck?.name).map((b) => b.amount), DEFAULT_QUICK_HOURS),
    [truckBookings, selectedTruck?.name],
  )
  const allSiteNames = useMemo(() => orderSiteNames(recentBookings, constructionSites), [recentBookings, constructionSites])

  function applyBooking(booking: RecentBooking) {
    const truck = trucks.find((t) => t.name === booking.productName)
    if (truck) setSelectedTruckId(truck.id)
    setHours(String(booking.amount))
    setConstructionSiteName(currentSiteName(allSiteNames, booking.constructionSiteName))
  }

  async function submitRecord() {
    if (!isComplete || !selectedTruck) return

    const record = await createTruckRecord({
      truck: selectedTruck,
      hours: parsedHours,
      constructionSiteName,
      company,
    })
    if (!record) return

    const toUpload = photos
    setPhotos([])
    setSuccessRecord({
      constructionSiteName: constructionSiteName.trim(),
      truckName: selectedTruck.name,
      hours: parsedHours,
      total,
      record,
    })
    setStep('success')
    setSelectedTruckId(trucks[0]?.id ?? 0)
    setHours('')
    setConstructionSiteName('')
    if (toUpload.length) await uploadPhotos(record.id, toUpload, 0)
  }

  // Photos go up one by one after the Vorgang exists; the ones that fail stay
  // here and can be sent again from the success screen.
  async function uploadPhotos(recordId: number, pending: PendingPhoto[], alreadySent: number) {
    setIsUploadingPhotos(true)
    setPhotoUpload({ sent: alreadySent, failed: pending, error: '' })
    let sent = alreadySent
    const failed: PendingPhoto[] = []
    let error = ''
    for (const photo of pending) {
      try {
        const result = await uploadDeliveryNotePhoto({
          data: { recordId, fileBase64: await blobToDataUrl(photo.blob), contentType: 'image/jpeg' },
        })
        if (!result.ok) throw new Error(result.message)
        URL.revokeObjectURL(photo.previewUrl)
        sent++
      } catch (uploadError) {
        failed.push(photo)
        error = uploadError instanceof Error ? uploadError.message : 'Übertragung fehlgeschlagen.'
      }
      setPhotoUpload({ sent, failed: [...failed, ...pending.slice(pending.indexOf(photo) + 1)], error: '' })
    }
    setPhotoUpload({ sent, failed, error })
    setIsUploadingPhotos(false)
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

  if (step === 'form') {
    return (
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="font-title text-4xl text-slate-900">LKW und Stunden</h3>
        <p className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Kunde: <strong>{company.name}</strong>
        </p>

        {lastBooking && <LastBookingButton booking={lastBooking} onApply={() => applyBooking(lastBooking)} />}

        <div className="grid gap-5">
          <ChoiceButtons
            label="LKW"
            options={trucks.map((truck) => ({ value: truck.id, title: truck.name, detail: `${money(truck.price)} / Std. netto` }))}
            value={selectedTruckId}
            onChange={setSelectedTruckId}
          />
          <QuickAmountPicker label="Stunden" unit="Std." value={hours} onChange={setHours} quickAmounts={quickHours} />
          <SitePicker siteNames={allSiteNames} value={constructionSiteName} onChange={setConstructionSiteName} />
        </div>

        {withDeliveryNotePhotos && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Lieferscheine (optional)</p>
            <p className="mb-3 text-sm text-slate-600">
              Lieferscheine von der Deponie usw. fotografieren. Mehrere Fotos möglich; sie werden mit dem Vorgang ans Büro
              übertragen.
            </p>
            <DeliveryNotePhotoPicker photos={photos} onChange={setPhotos} />
          </div>
        )}

        <BookingSummary
          headline={
            validHours && selectedTruck
              ? `${formatAmount(parsedHours)} Std. ${selectedTruck.name}${
                  withDeliveryNotePhotos && photos.length ? ` · ${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}` : ''
                }`
              : null
          }
          siteName={constructionSiteName}
          unitPriceText={`${money(currentHourlyPrice)} / Std. netto`}
          total={total}
          emptyText={
            <>
              Stundenpreis: <strong>{money(currentHourlyPrice)}</strong> / Std. (netto). Stunden wählen, dann erscheint die Summe.
            </>
          }
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl bg-slate-100 px-6 py-4 text-base font-semibold text-slate-700 hover:bg-slate-200"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={submitRecord}
            disabled={!isComplete || isCreatingTruckRecord}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isCreatingTruckRecord && <Spinner className="h-5 w-5" />}
            Vorgang anlegen
          </button>
        </div>
      </div>
    )
  }

  if (step === 'success' && successRecord) {
    return (
      <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-6 shadow-card">
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

        {photoUpload && (
          <div
            className={`rounded-xl p-4 ${
              isUploadingPhotos ? 'bg-slate-50 text-slate-800' : photoUpload.failed.length ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {isUploadingPhotos ? (
              <p className="flex items-center gap-2 font-semibold">
                <Spinner className="h-5 w-5" /> Lieferschein-Fotos werden übertragen … ({photoUpload.sent} gesendet)
              </p>
            ) : photoUpload.failed.length ? (
              <>
                <p className="font-semibold">
                  {photoUpload.sent} Foto(s) übertragen, {photoUpload.failed.length} nicht. {photoUpload.error}
                </p>
                <button
                  type="button"
                  onClick={() => void uploadPhotos(successRecord.record.id, photoUpload.failed, photoUpload.sent)}
                  className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-red-700 px-5 text-base font-semibold text-white hover:bg-red-800"
                >
                  Fotos erneut senden
                </button>
              </>
            ) : (
              <p className="font-semibold">
                {photoUpload.sent} {photoUpload.sent === 1 ? 'Lieferschein-Foto wurde' : 'Lieferschein-Fotos wurden'} ans Büro
                übertragen.
              </p>
            )}
          </div>
        )}

        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">LKW</dt>
            <dd className="font-semibold">{successRecord.truckName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">Baustelle</dt>
            <dd className="font-semibold">{successRecord.constructionSiteName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">Stunden</dt>
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
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-base font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingNote && <Spinner className="h-4 w-4" />}
            Lieferschein herunterladen
          </button>
          <button
            type="button"
            onClick={onExit}
            disabled={isUploadingPhotos}
            className="rounded-xl border-2 border-brand-600 bg-white px-6 py-4 text-base font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Neuen Vorgang anlegen
          </button>
          <Link
            to={vorgaengeTo}
            className="rounded-xl bg-slate-100 px-6 py-4 text-base font-semibold text-slate-700 no-underline hover:bg-slate-200"
          >
            Zu den Vorgängen
          </Link>
        </div>
      </div>
    )
  }

  return null
}
