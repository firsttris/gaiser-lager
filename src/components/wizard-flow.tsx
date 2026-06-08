import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState, type FlowType } from '../state/app-state'

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function WizardFlow({ flowType }: { flowType: FlowType }) {
  const { products, selectedCompany, createRecord } = useAppState()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState(
    () => products.find((p) => p.flow === flowType)?.id ?? 0,
  )
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [successRecord, setSuccessRecord] = useState<{
    type: FlowType
    productName: string
    amount: number
    unit: string
    total: number
    note: string
  } | null>(null)

  const availableProducts = products.filter((p) => p.flow === flowType)
  const selectedProduct = availableProducts.find((p) => p.id === Number(selectedProductId))
  const parsedAmount = Number(amount)
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
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
    if (!selectedProduct || !validAmount) return

    createRecord({ type: flowType, product: selectedProduct, amount: parsedAmount, note })

    setSuccessRecord({
      type: flowType,
      productName: selectedProduct.name,
      amount: parsedAmount,
      unit: selectedProduct.unit,
      total,
      note,
    })
    setStep(3)
    setSelectedProductId(products.find((p) => p.flow === flowType)?.id ?? 0)
    setAmount('')
    setNote('')
  }

  if (step === 1) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h3 className="font-title text-4xl text-slate-900">Material und Menge</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Material</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
            >
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Notiz (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Baustelle, Fahrzeug, Hinweis"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
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
            disabled={!validAmount}
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
            <dt className="text-slate-500">Einzelpreis</dt>
            <dd className="font-semibold">
              {money(currentUnitPrice)} ({priceCategoryLabel})
            </dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <dt className="text-amber-700">Gesamtsumme</dt>
            <dd className="text-lg font-bold text-amber-800">{money(total)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
            <dt className="text-slate-500">Notiz</dt>
            <dd className="font-semibold">{note || '-'}</dd>
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
            <dt className="text-slate-500">Menge</dt>
            <dd className="font-semibold">
              {successRecord.amount} {successRecord.unit}
            </dd>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <dt className="text-emerald-700">Gesamtsumme</dt>
            <dd className="text-lg font-bold text-emerald-800">{money(successRecord.total)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
            <dt className="text-slate-500">Notiz</dt>
            <dd className="font-semibold">{successRecord.note || '-'}</dd>
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
