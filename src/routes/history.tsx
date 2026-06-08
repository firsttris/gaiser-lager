import { createFileRoute, Link } from '@tanstack/react-router'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/history')({ component: HistoryPage })

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function HistoryPage() {
  const { isLoggedIn, records } = useAppState()

  if (!isLoggedIn) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Die Historie ist nur nach Firmen-PIN verfuegbar.</p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            Zum Login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <TopNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h1 className="font-title text-5xl text-slate-900">Historie</h1>

        {records.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-slate-600">
            Noch keine Vorgaenge. Lege im Wizard deinen ersten Vorgang an.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {records.map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{record.productName}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {record.type === 'pickup' ? 'Material holen' : 'Material bringen'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {record.amount} {record.unit} x {money(record.unitPrice)} = {money(record.total)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {record.createdAt} | Status: {record.status}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
