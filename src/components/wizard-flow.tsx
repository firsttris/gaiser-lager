import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { History, Plus } from 'lucide-react'
import { constructionSitesQueryOptions } from '../server/construction-sites'
import { recentBookingsQueryOptions, type RecentBooking } from '../server/records'
import { useMemo, useState } from 'react'
import { AutocompleteInput } from './autocomplete-input'
import { AmountPadDialog, formatAmount } from './amount-dialog'
import { useAppState, type Company, type FlowType, type RecordItem } from '../state/app-state'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { resolvePublicAssetUrl } from '../utils/public-asset-url'
import { Spinner } from './spinner'

// Uploaded material photos are already absolute Supabase Storage URLs;
// resolvePublicAssetUrl is only meant for the bundled /assets/* fallbacks.
function resolveVisualImageUrl(imagePath: string) {
  return /^https?:\/\//.test(imagePath) ? imagePath : resolvePublicAssetUrl(imagePath)
}

type ProductVisual = {
  gradient: string
  emoji: string
  imagePath?: string
}

const productVisuals: Record<number, ProductVisual> = {
  // Annahme (dropoff)
  1: { gradient: 'from-gray-400 to-gray-500', emoji: '🧱', imagePath: '/assets/Annahme/Unbewehrter Betonschutt, Pflastersteine, Stahlbeton.jpeg' },
  3: { gradient: 'from-gray-500 to-gray-700', emoji: '🏗️', imagePath: '/assets/Annahme/Stark bewehrter Betonschutt.jpg' },
  4: { gradient: 'from-gray-700 to-gray-900', emoji: '🛣️', imagePath: '/assets/Annahme/Bituminöser Straßenaufbruch.jpeg' },
  5: { gradient: 'from-stone-400 to-stone-600', emoji: '🗑️', imagePath: '/assets/Annahme/Gemischter Bauschutt.jpeg' },
  6: { gradient: 'from-amber-700 to-amber-900', emoji: '⛏️', imagePath: '/assets/Annahme/Aushub.jpeg' },
  7: { gradient: 'from-amber-800 to-stone-800', emoji: '🚧', imagePath: '/assets/Annahme/Aushub mit Bauschutt o.ä. vermischt.jpeg' },
  // Verkauf (pickup)
  8: { gradient: 'from-gray-300 to-gray-500', emoji: '♻️', imagePath: '/assets/Verkauf/Betonrecycling 0-45 FSS-STS.jpg' },
  9: { gradient: 'from-stone-300 to-stone-500', emoji: '♻️', imagePath: '/assets/Verkauf/Bauschutt Recycling 0-56.jpeg' },
  10: { gradient: 'from-green-700 to-green-900', emoji: '🌱', imagePath: '/assets/Verkauf/Gesiebt Mutterboden.jpeg' },
  11: { gradient: 'from-slate-400 to-slate-600', emoji: '🪨', imagePath: '/assets/Verkauf/Rollkies 8-16.jpeg' },
  12: { gradient: 'from-slate-300 to-slate-500', emoji: '🪨', imagePath: '/assets/Verkauf/Mischkies 0-16.jpg' },
  13: { gradient: 'from-yellow-200 to-yellow-400', emoji: '🏖️', imagePath: '/assets/Verkauf/Sand 0-2.jpeg' },
  14: { gradient: 'from-yellow-300 to-amber-400', emoji: '🏝️', imagePath: '/assets/Verkauf/Schwemmsand.jpg' },
  15: { gradient: 'from-stone-400 to-stone-600', emoji: '⛰️', imagePath: '/assets/Verkauf/Mineralgemisch 0-16.jpeg' },
  16: { gradient: 'from-stone-500 to-stone-700', emoji: '⛰️', imagePath: '/assets/Verkauf/Mineralgemisch 0-32.jpeg' },
  17: { gradient: 'from-slate-500 to-slate-700', emoji: '💎', imagePath: '/assets/Verkauf/Splitt 2-5.jpeg' },
}

const fallbackVisuals: ProductVisual[] = [
  { gradient: 'from-slate-400 to-slate-600', emoji: '📦' },
  { gradient: 'from-zinc-400 to-zinc-600', emoji: '📦' },
  { gradient: 'from-neutral-400 to-neutral-600', emoji: '📦' },
]

function getVisual(product: { id: number; imageUrl: string | null }): ProductVisual {
  const staticVisual = productVisuals[product.id] ?? fallbackVisuals[product.id % fallbackVisuals.length]
  return product.imageUrl ? { ...staticVisual, imagePath: product.imageUrl } : staticVisual
}

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

// One-tap amounts on the kiosk: the amounts this company booked most often
// for the material, topped up with round defaults until the row is full.
const DEFAULT_QUICK_AMOUNTS = [5, 10, 15, 20, 25]
const QUICK_AMOUNT_COUNT = 5
const SITE_CHOICE_COUNT = 5

function buildQuickAmounts(history: number[]) {
  const counts = new Map<number, number>()
  for (const amount of history) counts.set(amount, (counts.get(amount) ?? 0) + 1)
  const frequent = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, QUICK_AMOUNT_COUNT)
    .map(([amount]) => amount)
  for (const amount of DEFAULT_QUICK_AMOUNTS) {
    if (frequent.length >= QUICK_AMOUNT_COUNT) break
    if (!frequent.includes(amount)) frequent.push(amount)
  }
  return frequent.sort((a, b) => a - b)
}

// Recently used sites first, then the rest of the company's sites by name.
function buildSiteChoices(recent: RecentBooking[], allSites: { name: string }[]) {
  const names: string[] = []
  for (const booking of recent) {
    if (names.length >= SITE_CHOICE_COUNT) break
    if (!names.includes(booking.constructionSiteName)) names.push(booking.constructionSiteName)
  }
  for (const site of allSites) {
    if (names.length >= SITE_CHOICE_COUNT) break
    if (!names.includes(site.name)) names.push(site.name)
  }
  return names
}

export function WizardFlow({
  flowType,
  company,
  onExit,
  vorgaengeTo = '/kunde/vorgaenge',
}: {
  flowType: FlowType
  /** Overrides the logged-in customer's company, used by the admin flow to create a Vorgang on behalf of a customer. */
  company?: Company
  /** Called instead of navigating to the customer wizard start when set, used by the admin flow to return to its own selection step. */
  onExit?: () => void
  vorgaengeTo?: string
}) {
  const { products, selectedCompany: loggedInCompany, createRecord, isCreatingRecord } = useAppState()
  const selectedCompany = company ?? loggedInCompany
  const { data: constructionSites = [] } = useQuery(constructionSitesQueryOptions(selectedCompany?.id))
  const { data: recentBookings = [] } = useQuery(recentBookingsQueryOptions(selectedCompany?.id))
  const navigate = useNavigate()

  const [step, setStep] = useState<'form' | 'success'>('form')
  const [isAmountDialogOpen, setIsAmountDialogOpen] = useState(false)
  const [isSiteInputOpen, setIsSiteInputOpen] = useState(false)
  const [isDownloadingNote, setIsDownloadingNote] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(
    () => products.find((p) => p.flow === flowType)?.id ?? 0,
  )
  const [amount, setAmount] = useState('')
  const [constructionSiteName, setConstructionSiteName] = useState('')
  const [successRecord, setSuccessRecord] = useState<{
    type: FlowType
    constructionSiteName: string
    productName: string
    productId: number
    amount: number
    unit: string
    total: number
    record: RecordItem
  } | null>(null)

  const availableProducts = products.filter((p) => p.flow === flowType)
  const selectedProduct = availableProducts.find((p) => p.id === Number(selectedProductId))
  const parsedAmount = Number(amount)
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const validConstructionSiteName = constructionSiteName.trim().length > 0
  const currentUnitPrice = selectedProduct?.price ?? 0
  const total = validAmount ? parsedAmount * currentUnitPrice : 0
  const unit = selectedProduct?.unit ?? ''
  const isComplete = Boolean(selectedProduct) && validAmount && validConstructionSiteName

  const flowBookings = useMemo(() => recentBookings.filter((booking) => booking.type === flowType), [recentBookings, flowType])
  // "Wie zuletzt" only for a material that is still on offer.
  const lastBooking = flowBookings.find((booking) => availableProducts.some((p) => p.name === booking.productName))
  const quickAmounts = useMemo(
    () => buildQuickAmounts(flowBookings.filter((b) => b.productName === selectedProduct?.name).map((b) => b.amount)),
    [flowBookings, selectedProduct?.name],
  )
  const isCustomAmount = validAmount && !quickAmounts.includes(parsedAmount)
  const siteChoices = useMemo(() => buildSiteChoices(recentBookings, constructionSites), [recentBookings, constructionSites])
  const trimmedSiteName = constructionSiteName.trim()
  // The text field shows whenever there is nothing to tap, or the chosen site
  // isn't among the buttons (typed, or filled in via "Wie zuletzt").
  const showSiteInput =
    isSiteInputOpen || siteChoices.length === 0 || (validConstructionSiteName && !siteChoices.includes(trimmedSiteName))

  function applyBooking(booking: RecentBooking) {
    const product = availableProducts.find((p) => p.name === booking.productName)
    if (product) setSelectedProductId(product.id)
    setAmount(String(booking.amount))
    setConstructionSiteName(booking.constructionSiteName)
    setIsSiteInputOpen(false)
  }

  async function submitRecord() {
    if (!selectedProduct || !validAmount || !validConstructionSiteName) return

    const record = await createRecord({
      type: flowType,
      product: selectedProduct,
      amount: parsedAmount,
      constructionSiteName,
      company,
    })
    if (!record) return

    setSuccessRecord({
      type: flowType,
      constructionSiteName: constructionSiteName.trim(),
      productName: selectedProduct.name,
      productId: selectedProduct.id,
      amount: parsedAmount,
      unit: selectedProduct.unit,
      total,
      record,
    })
    setStep('success')
    setSelectedProductId(products.find((p) => p.flow === flowType)?.id ?? 0)
    setAmount('')
    setConstructionSiteName('')
    setIsSiteInputOpen(false)
  }

  async function redownloadDeliveryNote() {
    if (!successRecord || !selectedCompany) return

    setIsDownloadingNote(true)
    try {
      await downloadCombinedDeliveryNote(
        [successRecord.record],
        selectedCompany.name,
        successRecord.record.deliveryNoteId,
        selectedCompany,
      )
    } finally {
      setIsDownloadingNote(false)
    }
  }

  if (step === 'form') {
    const missingHint =
      !validAmount && !validConstructionSiteName
        ? 'Menge und Baustelle wählen, dann anlegen.'
        : !validAmount
          ? 'Noch die Menge wählen.'
          : !validConstructionSiteName
            ? 'Noch die Baustelle wählen.'
            : ''
    return (
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="font-title text-4xl text-slate-900">Material und Menge</h3>
        {company && (
          <p className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Kunde: <strong>{company.name}</strong>
          </p>
        )}

        {lastBooking && (
          <button
            type="button"
            onClick={() => applyBooking(lastBooking)}
            className="flex w-full items-center gap-4 rounded-xl border-2 border-brand-600 bg-brand-50 px-5 py-4 text-left hover:bg-brand-100"
          >
            <History className="h-7 w-7 shrink-0 text-brand-700" strokeWidth={2.25} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold tracking-wider text-brand-700 uppercase">Wie zuletzt</span>
              <span className="block truncate text-lg font-semibold text-slate-900">
                {formatAmount(lastBooking.amount)} {lastBooking.unit} {lastBooking.productName} · {lastBooking.constructionSiteName}
              </span>
              <span className="block text-sm text-slate-600">{lastBooking.createdAt}</span>
            </span>
          </button>
        )}

        <div className="grid gap-5">
          <div>
            <label className="text-sm font-semibold text-slate-700">Material</label>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {availableProducts.map((p) => {
                const visual = getVisual(p)
                const isSelected = p.id === selectedProductId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProductId(p.id)}
                    className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-brand-600 shadow-lg shadow-brand-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {visual.imagePath ? (
                      <img
                        src={resolveVisualImageUrl(visual.imagePath)}
                        alt={p.name}
                        className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className={`flex w-full aspect-video items-center justify-center bg-linear-to-br transition-transform duration-300 group-hover:scale-105 ${visual.gradient}`}
                      >
                        <span className="text-3xl">{visual.emoji}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute bottom-0 left-0 right-0 px-3 py-2 text-base font-semibold leading-tight text-white drop-shadow">
                      {p.name}
                    </span>
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                        <svg viewBox="0 0 20 20" className="h-3 w-3 text-white" fill="currentColor" aria-hidden="true">
                          <path d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.02 7.08a1 1 0 0 1-1.42.005L3.293 8.86a1 1 0 1 1 1.414-1.414l4.267 4.267 6.312-6.364a1 1 0 0 1 1.418-.058z" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>


          <div>
            <p className="text-sm font-semibold text-slate-700">Menge ({unit})</p>
            <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-6" role="group" aria-label="Menge">
              {quickAmounts.map((value) => {
                const isSelected = validAmount && parsedAmount === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    aria-pressed={isSelected}
                    className={`min-h-14 rounded-xl border-2 text-lg font-semibold tabular-nums transition ${
                      isSelected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {formatAmount(value)}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsAmountDialogOpen(true)}
                aria-pressed={isCustomAmount}
                className={`min-h-14 rounded-xl border-2 px-2 text-base font-semibold transition ${
                  isCustomAmount ? 'border-brand-600 bg-brand-50 text-brand-700 tabular-nums' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {isCustomAmount ? formatAmount(parsedAmount) : 'Andere …'}
              </button>
            </div>
          </div>

          <div>
            {siteChoices.length > 0 && (
              <>
              <p className="text-sm font-semibold text-slate-700">Baustelle</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Baustelle">
                {siteChoices.map((name) => {
                  const isSelected = trimmedSiteName === name
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setConstructionSiteName(name)
                        setIsSiteInputOpen(false)
                      }}
                      aria-pressed={isSelected}
                      className={`min-h-14 truncate rounded-xl border-2 px-4 text-left text-base font-semibold transition ${
                        isSelected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (siteChoices.includes(trimmedSiteName)) setConstructionSiteName('')
                    setIsSiteInputOpen(true)
                  }}
                  className={`flex min-h-14 items-center gap-2 rounded-xl border-2 border-dashed px-4 text-base font-semibold transition ${
                    showSiteInput ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                  Neue Baustelle
                </button>
              </div>
              </>
            )}
            {showSiteInput && (
              <div className={siteChoices.length > 0 ? 'mt-3' : undefined}>
                <AutocompleteInput
                  label={siteChoices.length > 0 ? 'Baustelle eingeben' : 'Baustelle'}
                  value={constructionSiteName}
                  onChange={setConstructionSiteName}
                  options={constructionSites.map((site) => ({ id: site.id, label: site.name, badge: 'bekannt' }))}
                  placeholder="z.B. Nordring 12, Berlin"
                  required
                  autoFocus={isSiteInputOpen}
                  helperText="Neue Baustelle wird beim Anlegen dieses Vorgangs gespeichert."
                  inputClassName="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 pr-14 text-lg outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>
        </div>

        {/* Replaces the former "Vorgang prüfen" step: everything that will be
            booked is readable right above the button. */}
        <div className={`rounded-xl p-4 ${isComplete ? 'bg-amber-50' : 'bg-slate-50'}`} aria-live="polite">
          {isComplete && selectedProduct ? (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {formatAmount(parsedAmount)} {unit} {selectedProduct.name}
                </p>
                <p className="text-slate-700">
                  {trimmedSiteName} · {money(currentUnitPrice)} / {unit} netto
                </p>
              </div>
              <p className="text-2xl font-bold text-amber-800">
                {money(total)} <span className="text-sm font-semibold">netto</span>
              </p>
            </div>
          ) : (
            <p className="text-slate-700">
              Einheitspreis: <strong>{money(currentUnitPrice)}</strong> / {unit} (netto). {missingHint}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (onExit ? onExit() : void navigate({ to: '/kunde/neuer-vorgang' }))}
            className="rounded-xl bg-slate-100 px-6 py-4 text-base font-semibold text-slate-700 hover:bg-slate-200"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={submitRecord}
            disabled={!isComplete || isCreatingRecord}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isCreatingRecord && <Spinner className="h-5 w-5" />}
            Vorgang anlegen
          </button>
        </div>

        <AmountPadDialog
          open={isAmountDialogOpen}
          unit={unit}
          initialValue={amount}
          onClose={() => setIsAmountDialogOpen(false)}
          onApply={(value) => {
            setAmount(value)
            setIsAmountDialogOpen(false)
          }}
        />
      </div>
    )
  }

  if (step === 'success' && successRecord) {
    const successProduct = products.find((p) => p.id === successRecord.productId)
    const step3Visual = getVisual({ id: successRecord.productId, imageUrl: successProduct?.imageUrl ?? null })
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

        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">Typ</dt>
            <dd className="font-semibold">{successRecord.type === 'pickup' ? 'Material holen' : 'Material bringen'}</dd>
          </div>
          <div className="relative overflow-hidden rounded-xl">
            {step3Visual.imagePath ? (
              <img
                src={resolveVisualImageUrl(step3Visual.imagePath)}
                alt={successRecord.productName}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className={`flex w-full aspect-video items-center justify-center bg-linear-to-br ${step3Visual.gradient}`}>
                <span className="text-3xl">{step3Visual.emoji}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
              <p className="text-xs text-white/70">Material</p>
              <p className="text-sm font-semibold text-white drop-shadow">{successRecord.productName}</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">Baustelle</dt>
            <dd className="font-semibold">{successRecord.constructionSiteName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-600">Menge</dt>
            <dd className="font-semibold">
              {successRecord.amount} {successRecord.unit}
            </dd>
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
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border-2 border-brand-600 bg-white px-6 py-4 text-base font-semibold text-brand-700 hover:bg-brand-50"
            >
              Neuen Vorgang anlegen
            </button>
          ) : (
            <Link
              to="/kunde/neuer-vorgang"
              className="rounded-xl border-2 border-brand-600 bg-white px-6 py-4 text-base font-semibold text-brand-700 no-underline hover:bg-brand-50"
            >
              Neuen Vorgang anlegen
            </Link>
          )}
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
