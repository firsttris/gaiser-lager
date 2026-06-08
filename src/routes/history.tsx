import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
  const { isLoggedIn, records, selectedCompany } = useAppState()
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')

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

  const companyRecords = records.filter((record) => record.company === selectedCompany?.name)

  const statusOptions = useMemo(() => {
    return Array.from(new Set(companyRecords.map((record) => record.status))).sort((a, b) => a.localeCompare(b, 'de'))
  }, [companyRecords])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')

    return companyRecords.filter((record) => {
      if (typeFilter !== 'all' && record.type !== typeFilter) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false

      if (!query) return true

      const haystack = `${record.productName} ${record.note} ${record.status}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyRecords, searchText, statusFilter, typeFilter])

  const pickupCount = filteredRecords.filter((record) => record.type === 'pickup').length
  const dropoffCount = filteredRecords.filter((record) => record.type === 'dropoff').length
  const totalRevenue = filteredRecords
    .filter((record) => record.type === 'pickup')
    .reduce((sum, record) => sum + record.total, 0)
  const totalCosts = filteredRecords
    .filter((record) => record.type === 'dropoff')
    .reduce((sum, record) => sum + record.total, 0)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <TopNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-title text-5xl text-slate-900">Historie</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgaenge fuer {selectedCompany?.name}.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredRecords.length} von {companyRecords.length} Eintraegen
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Typ
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | 'pickup' | 'dropoff')}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Typen</option>
              <option value="dropoff">Annahme</option>
              <option value="pickup">Verkauf</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Produkt, Notiz"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Annahme</p>
            <p className="text-lg font-semibold text-slate-900">{dropoffCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Verkauf</p>
            <p className="text-lg font-semibold text-slate-900">{pickupCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Summe Verkauf</p>
            <p className="text-lg font-semibold text-emerald-700">{money(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Summe Annahme</p>
            <p className="text-lg font-semibold text-rose-700">{money(totalCosts)}</p>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Eintraege fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-5xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Zeit</th>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Typ</th>
                  <th className="px-3 py-2">Produkt</th>
                  <th className="px-3 py-2">Menge</th>
                  <th className="px-3 py-2">Einzelpreis</th>
                  <th className="px-3 py-2">Gesamt</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-600">{record.createdAt}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{record.company}</td>
                    <td className="px-3 py-2">{record.type === 'pickup' ? 'Verkauf' : 'Annahme'}</td>
                    <td className="px-3 py-2">{record.productName}</td>
                    <td className="px-3 py-2">
                      {record.amount} {record.unit}
                    </td>
                    <td className="px-3 py-2">{money(record.unitPrice)}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{money(record.total)}</td>
                    <td className="px-3 py-2">{record.status}</td>
                    <td className="px-3 py-2 text-slate-600">{record.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
