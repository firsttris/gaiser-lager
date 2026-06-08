import { createFileRoute, Link } from '@tanstack/react-router'
import { jsPDF } from 'jspdf'
import { useMemo, useState } from 'react'
import { TopNav } from '../components/top-nav'
import { type RecordItem, useAppState } from '../state/app-state'

export const Route = createFileRoute('/history')({ component: HistoryPage })

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function typeLabel(type: 'pickup' | 'dropoff') {
  return type === 'pickup' ? 'Verkauf' : 'Annahme'
}

function toFileSafeDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function truncatePdfText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

function appendDeliveryNotePage(pdf: jsPDF, record: RecordItem, companyName: string, newPage: boolean) {
  if (newPage) {
    pdf.addPage()
  }

  const left = 15
  let y = 20

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Lieferschein', left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left, y)

  y += 6
  pdf.setFontSize(10)
  pdf.text(`Belegnummer: ${record.id}`, left, y)
  y += 5
  pdf.text(`Datum: ${record.createdAt}`, left, y)
  y += 5
  pdf.text(`Firma: ${companyName}`, left, y)
  y += 5
  pdf.text(`Vorgang: ${typeLabel(record.type)}`, left, y)

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('Position', left, y)
  y += 6
  pdf.setDrawColor(180)
  pdf.line(left, y, 195, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Material: ${record.productName}`, left, y)
  y += 6
  pdf.text(`Menge: ${record.amount} ${record.unit}`, left, y)
  y += 6
  pdf.text(`Einzelpreis: ${money(record.unitPrice)}`, left, y)
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Gesamt: ${money(record.total)}`, left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Status: ${record.status}`, left, y)
  y += 6
  const noteText = truncatePdfText(record.note || '-', 90)
  pdf.text(`Notiz: ${noteText}`, left, y)

  y += 14
  pdf.setDrawColor(180)
  pdf.line(left, y, 95, y)
  pdf.line(115, y, 195, y)
  y += 5
  pdf.setFontSize(9)
  pdf.text('Unterschrift Kunde', left, y)
  pdf.text('Unterschrift Gaiser', 115, y)
}

function downloadDeliveryNote(record: RecordItem, companyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  appendDeliveryNotePage(pdf, record, companyName, false)

  const fileName = `lieferschein-${record.id}-${toFileSafeDate(record.createdAt)}.pdf`
  pdf.save(fileName)
}

function downloadCombinedDeliveryNote(records: RecordItem[], companyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  let y = 20

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Lieferschein', left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left, y)

  y += 6
  pdf.setFontSize(10)
  pdf.text(`Datum: ${new Date().toLocaleString('de-DE')}`, left, y)
  y += 5
  pdf.text(`Firma: ${companyName}`, left, y)
  y += 5
  pdf.text(`Positionen: ${records.length}`, left, y)

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('Positionen', left, y)
  y += 6
  pdf.setDrawColor(180)
  pdf.line(left, y, 195, y)

  y += 7
  let total = 0

  for (const [index, record] of records.entries()) {
    if (y > 260) {
      pdf.addPage()
      y = 20
    }

    total += record.total

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(`${index + 1}. ${record.productName}`, left, y)
    y += 5

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Belegnummer: ${record.id} | Vorgang: ${typeLabel(record.type)} | Zeit: ${record.createdAt}`, left, y)
    y += 5
    pdf.text(`Menge: ${record.amount} ${record.unit} | Einzelpreis: ${money(record.unitPrice)} | Gesamt: ${money(record.total)}`, left, y)
    y += 5
    const noteText = truncatePdfText(record.note || '-', 70)
    pdf.text(`Status: ${record.status} | Notiz: ${noteText}`, left, y)
    y += 6

    pdf.setDrawColor(220)
    pdf.line(left, y, 195, y)
    y += 5
  }

  if (y > 255) {
    pdf.addPage()
    y = 20
  }

  pdf.setDrawColor(180)
  pdf.line(left, y, 195, y)
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(`Gesamtsumme: ${money(total)}`, left, y)

  y += 16
  pdf.setDrawColor(180)
  pdf.line(left, y, 95, y)
  pdf.line(115, y, 195, y)
  y += 5
  pdf.setFontSize(9)
  pdf.text('Unterschrift Kunde', left, y)
  pdf.text('Unterschrift Gaiser', 115, y)

  const fileName = `lieferschein-sammel-${toFileSafeDate(new Date().toLocaleString('de-DE'))}.pdf`
  pdf.save(fileName)
}

function HistoryPage() {
  const { isLoggedIn, records, selectedCompany } = useAppState()
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])

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

  const selectedSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds])
  const selectedCount = filteredRecords.filter((record) => selectedSet.has(record.id)).length

  function toggleRecordSelection(recordId: number) {
    setSelectedRecordIds((prev) => {
      if (prev.includes(recordId)) {
        return prev.filter((id) => id !== recordId)
      }

      return [...prev, recordId]
    })
  }

  function selectAllVisible() {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev)
      filteredRecords.forEach((record) => next.add(record.id))
      return Array.from(next)
    })
  }

  function clearSelection() {
    setSelectedRecordIds([])
  }

  function createCombinedDeliveryNote() {
    const selectedRecords = filteredRecords.filter((record) => selectedSet.has(record.id))
    if (selectedRecords.length === 0) return

    downloadCombinedDeliveryNote(selectedRecords, selectedCompany?.name ?? '')
  }

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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Alle sichtbaren markieren
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Auswahl leeren
          </button>
          <button
            type="button"
            onClick={createCombinedDeliveryNote}
            disabled={selectedCount === 0}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lieferschein erstellen ({selectedCount})
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Eintraege fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {filteredRecords.map((record) => (
                <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">{record.createdAt}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{record.productName}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {typeLabel(record.type)}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(record.id)}
                      onChange={() => toggleRecordSelection(record.id)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label={`Eintrag ${record.id} markieren`}
                    />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">Menge</dt>
                      <dd className="font-semibold text-slate-800">
                        {record.amount} {record.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Einzelpreis</dt>
                      <dd className="font-semibold text-slate-800">{money(record.unitPrice)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Gesamt</dt>
                      <dd className="font-semibold text-slate-900">{money(record.total)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status</dt>
                      <dd className="font-semibold text-slate-800">{record.status}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 max-w-full whitespace-pre-wrap wrap-break-word text-xs text-slate-600">
                    Notiz: {record.note || '-'}
                  </p>

                </article>
              ))}
            </div>

            <div className="mt-4 hidden md:block">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={filteredRecords.length > 0 && filteredRecords.every((record) => selectedSet.has(record.id))}
                        onChange={(event) => {
                          if (event.target.checked) {
                            selectAllVisible()
                          } else {
                            setSelectedRecordIds((prev) => prev.filter((id) => !filteredRecords.some((record) => record.id === id)))
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label="Alle sichtbaren Eintraege markieren"
                      />
                    </th>
                    <th className="w-28 px-2 py-2">Zeit</th>
                    <th className="w-20 px-2 py-2">Typ</th>
                    <th className="px-2 py-2">Produkt</th>
                    <th className="w-16 px-2 py-2">Menge</th>
                    <th className="hidden w-24 px-2 py-2 lg:table-cell">Preis</th>
                    <th className="w-24 px-2 py-2">Gesamt</th>
                    <th className="w-24 px-2 py-2">Status</th>
                    <th className="hidden w-44 px-2 py-2 xl:table-cell">Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Eintrag ${record.id} markieren`}
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600">{record.createdAt}</td>
                    <td className="px-2 py-2">{typeLabel(record.type)}</td>
                    <td className="px-2 py-2">
                      <p className="truncate" title={record.productName}>{record.productName}</p>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {record.amount} {record.unit}
                    </td>
                    <td className="hidden px-2 py-2 lg:table-cell">{money(record.unitPrice)}</td>
                    <td className="px-2 py-2 font-semibold text-slate-900">{money(record.total)}</td>
                    <td className="px-2 py-2 text-xs">{record.status}</td>
                    <td className="hidden px-2 py-2 text-slate-600 xl:table-cell">
                      <p className="line-clamp-2 whitespace-pre-wrap wrap-break-word">{record.note || '-'}</p>
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
