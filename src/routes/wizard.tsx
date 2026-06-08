import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Truck } from 'lucide-react'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useAppState, type FlowType } from '../state/app-state'

export const Route = createFileRoute('/wizard')({ component: WizardPage })

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function FlowChoiceCard({
  type,
  title,
  subtitle,
  onClick,
}: {
  type: FlowType
  title: string
  subtitle: string
  onClick: () => void
}) {
  const isPickup = type === 'pickup'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
        isPickup
          ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
          : 'border-sky-200 bg-sky-50 hover:border-sky-300'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
            isPickup ? 'border-amber-200 bg-white text-amber-700' : 'border-sky-200 bg-white text-sky-700'
          }`}
        >
          <Truck className="h-7 w-7" strokeWidth={1.9} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
            {isPickup ? 'Abholung' : 'Annahme'}
          </p>
          <h3 className="font-title mt-1 text-4xl text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div
          className={`hidden h-12 w-12 items-center justify-center rounded-full sm:flex ${
            isPickup ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {isPickup ? <ArrowDownToLine className="h-6 w-6" strokeWidth={2.2} /> : <ArrowUpFromLine className="h-6 w-6" strokeWidth={2.2} />}
        </div>
      </div>
    </button>
  )
}

function WizardPage() {
  const { isLoggedIn, products, selectedCompany, createRecord } = useAppState()
  const [step, setStep] = useState(1)
  const [flowType, setFlowType] = useState<FlowType>('pickup')
  const [selectedProductId, setSelectedProductId] = useState(
    () => products.find((p) => p.flow === 'pickup')?.id ?? 0,
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

  if (!isLoggedIn) {
    return (
      <PageShell>
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Der Wizard ist nur nach Firmen-PIN verfuegbar.</p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            Zum Login
          </Link>
        </section>
      </PageShell>
    )
  }

  const availableProducts = products.filter((p) => p.flow === flowType)
  const selectedProduct = availableProducts.find((product) => product.id === Number(selectedProductId))
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

  function resetWizard() {
    setStep(1)
    setFlowType('pickup')
    setSelectedProductId(products.find((p) => p.flow === 'pickup')?.id ?? 0)
    setAmount('')
    setNote('')
    setSuccessRecord(null)
  }

  function submitRecord() {
    if (!selectedProduct || !validAmount) return

    createRecord({
      type: flowType,
      product: selectedProduct,
      amount: parsedAmount,
      note,
    })

    setSuccessRecord({
      type: flowType,
      productName: selectedProduct.name,
      amount: parsedAmount,
      unit: selectedProduct.unit,
      total,
      note,
    })
    setStep(4)
    setFlowType('pickup')
    setSelectedProductId(products.find((p) => p.flow === 'pickup')?.id ?? 0)
    setAmount('')
    setNote('')
  }

  return (
    <PageShell>
      <TopNav />

      <section className="space-y-4">
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <FlowChoiceCard
              type="pickup"
              title="Material holen"
              subtitle="Material abholen."
              onClick={() => {
                setFlowType('pickup')
                setSelectedProductId(products.find((p) => p.flow === 'pickup')?.id ?? 0)
                setStep(2)
              }}
            />

            <FlowChoiceCard
              type="dropoff"
              title="Bauschutt bringen"
              subtitle="Material anliefern."
              onClick={() => {
                setFlowType('dropoff')
                setSelectedProductId(products.find((p) => p.flow === 'dropoff')?.id ?? 0)
                setStep(2)
              }}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <h3 className="font-title text-4xl text-slate-900">Material und Menge</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Material</label>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                >
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Menge ({selectedProduct?.unit})</label>
                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))
                  }
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
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Baustelle, Fahrzeug, Hinweis"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
              ></textarea>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              Tarif: <strong>{priceCategoryLabel}</strong>
              <br />
              Einheitspreis: <strong>{money(currentUnitPrice)}</strong> / {selectedProduct?.unit}
            </div>

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
                onClick={() => setStep(3)}
                disabled={!validAmount}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Weiter zu Pruefung
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <h3 className="font-title text-4xl text-slate-900">Vorgang pruefen</h3>
            <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-slate-500">Typ</dt>
                <dd className="font-semibold">
                  {flowType === 'pickup' ? 'Material holen' : 'Material bringen'}
                </dd>
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
                onClick={() => setStep(2)}
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
        )}

        {step === 4 && successRecord && (
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
                <dd className="font-semibold">
                  {successRecord.type === 'pickup' ? 'Material holen' : 'Material bringen'}
                </dd>
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
              <button
                type="button"
                onClick={resetWizard}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Neuen Vorgang anlegen
              </button>
              <Link
                to="/history"
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
              >
                Zur Historie
              </Link>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  )
}
