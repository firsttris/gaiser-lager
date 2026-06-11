import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AutocompleteInput } from './autocomplete-input'
import { useAppState, type FlowType } from '../state/app-state'

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

function getVisual(productId: number): ProductVisual {
  return productVisuals[productId] ?? fallbackVisuals[productId % fallbackVisuals.length]
}

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function resolvePublicAssetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

export function WizardFlow({ flowType }: { flowType: FlowType }) {
  const { products, selectedCompany, constructionSites, createRecord } = useAppState()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState(
    () => products.find((p) => p.flow === flowType)?.id ?? 0,
  )
  const [amount, setAmount] = useState('')
  const [constructionSiteName, setConstructionSiteName] = useState('')
  const [successRecord, setSuccessRecord] = useState<{
    type: FlowType
    constructionSiteName: string
    productName: string
    amount: number
    unit: string
    total: number
  } | null>(null)

  const availableProducts = products.filter((p) => p.flow === flowType)
  const selectedProduct = availableProducts.find((p) => p.id === Number(selectedProductId))
  const parsedAmount = Number(amount)
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const validConstructionSiteName = constructionSiteName.trim().length > 0
  const currentUnitPrice = selectedProduct
    ? flowType === 'pickup'
      ? selectedCompany?.priceCategory === 'private'
        ? selectedProduct.pickupPrivatePrice
        : selectedProduct.pickupBusinessPrice
      : selectedCompany?.priceCategory === 'private'
        ? selectedProduct.dropoffPrivatePrice
        : selectedProduct.dropoffBusinessPrice
    : 0
  const priceCategoryLabel = selectedCompany?.priceCategory === 'private' ? 'Privat' : 'Unternehmen'
  const total = validAmount ? parsedAmount * currentUnitPrice : 0

  function submitRecord() {
    if (!selectedProduct || !validAmount || !validConstructionSiteName) return

    createRecord({
      type: flowType,
      product: selectedProduct,
      amount: parsedAmount,
      constructionSiteName,
    })

    setSuccessRecord({
      type: flowType,
      constructionSiteName: constructionSiteName.trim(),
      productName: selectedProduct.name,
      amount: parsedAmount,
      unit: selectedProduct.unit,
      total,
    })
    setStep(3)
    setSelectedProductId(products.find((p) => p.flow === flowType)?.id ?? 0)
    setAmount('')
    setConstructionSiteName('')
  }

  if (step === 1) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h3 className="font-title text-4xl text-slate-900">Material und Menge</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Material</label>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {availableProducts.map((p) => {
                const visual = getVisual(p.id)
                const isSelected = p.id === selectedProductId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProductId(p.id)}
                    className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 shadow-lg shadow-amber-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {visual.imagePath ? (
                      <img
                        src={resolvePublicAssetUrl(visual.imagePath)}
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
                    <span className="absolute bottom-0 left-0 right-0 truncate px-3 py-2 text-xs font-semibold leading-tight text-white drop-shadow sm:overflow-visible sm:whitespace-normal sm:text-clip sm:wrap-anywhere">
                      {p.name}
                    </span>
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
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
            <label className="text-sm font-semibold text-slate-700">Menge ({selectedProduct?.unit})</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              inputMode="decimal"
              placeholder="z.B. 12.5"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
            />
          </div>

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

        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          Tarif: <strong>{priceCategoryLabel}</strong>
          <br />
          Einheitspreis: <strong>{money(currentUnitPrice)}</strong> / {selectedProduct?.unit}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: '/wizard' })}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Zurueck
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!validAmount || !validConstructionSiteName}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Weiter zu Pruefung
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h3 className="font-title text-4xl text-slate-900">Vorgang pruefen</h3>
        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Typ</dt>
            <dd className="font-semibold">{flowType === 'pickup' ? 'Material holen' : 'Material bringen'}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Material</dt>
            <dd className="font-semibold">{selectedProduct?.name}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Menge</dt>
            <dd className="font-semibold">
              {amount} {selectedProduct?.unit}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Baustelle</dt>
            <dd className="font-semibold">{constructionSiteName.trim()}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Einzelpreis</dt>
            <dd className="font-semibold">
              {money(currentUnitPrice)} ({priceCategoryLabel})
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
            Zurueck
          </button>
          <button
            type="button"
            onClick={submitRecord}
            disabled={!validAmount || !validConstructionSiteName}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
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
            <p className="text-slate-600">Der Eintrag wurde gespeichert und ist in der Historie sichtbar.</p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Typ</dt>
            <dd className="font-semibold">{successRecord.type === 'pickup' ? 'Material holen' : 'Material bringen'}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Material</dt>
            <dd className="font-semibold">{successRecord.productName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Baustelle</dt>
            <dd className="font-semibold">{successRecord.constructionSiteName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Menge</dt>
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
          <Link
            to="/wizard"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-slate-800"
          >
            Neuen Vorgang anlegen
          </Link>
          <Link
            to="/history"
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
          >
            Zur Historie
          </Link>
        </div>
      </div>
    )
  }

  return null
}
