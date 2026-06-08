import { createFileRoute } from '@tanstack/react-router'
import { jsPDF } from 'jspdf'
import { useMemo, useState } from 'react'
import { type RecordStatus, useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/')({ component: AdminIndexPage })

function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function flowLabel(type: 'pickup' | 'dropoff') {
  return type === 'pickup' ? 'Verkauf' : 'Annahme'
}

const statusStages: Array<{ value: RecordStatus; label: string }> = [
  { value: 'offen', label: 'Offen' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'abgerechnet', label: 'Abgerechnet' },
  { value: 'bezahlt', label: 'Bezahlt' },
  { value: 'storniert', label: 'Storniert' },
]

function statusLabel(status: string) {
  return statusStages.find((stage) => stage.value === status)?.label ?? status
}

function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""')
  return `"${text}"`
}

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function AdminIndexPage() {
  const { companies, records, updateRecordStatus } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])

  const companyOptions = useMemo(() => {
    return companies.map((company) => company.name).sort((a, b) => a.localeCompare(b, 'de'))
  }, [companies])

  const statusOptions = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.status))).sort((a, b) => a.localeCompare(b, 'de'))
  }, [records])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')

    return records.filter((record) => {
      if (companyFilter !== 'all' && record.company !== companyFilter) return false
      if (typeFilter !== 'all' && record.type !== typeFilter) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false

      if (!query) return true

      const haystack = `${record.company} ${record.productName} ${record.note} ${record.status}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyFilter, records, searchText, statusFilter, typeFilter])

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

  function exportSelectedAsCsv() {
    const selectedRecords = filteredRecords.filter((record) => selectedSet.has(record.id))
    if (selectedRecords.length === 0) return

    const header = [
      'Zeit',
      'Firma',
      'Typ',
      'Produkt',
      'Menge',
      'Einheit',
      'Einzelpreis EUR',
      'Gesamt EUR',
      'Status',
      'Notiz',
    ]

    const rows = selectedRecords.map((record) => [
      record.createdAt,
      record.company,
      flowLabel(record.type),
      record.productName,
      record.amount,
      record.unit,
      record.unitPrice,
      record.total,
      statusLabel(record.status),
      record.note || '-',
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvCell(cell)).join(';'))
      .join('\n')

    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-history-${stamp}.csv`, csv)
  }

  function exportSelectedAsInvoicePdf() {
    const selectedRecords = filteredRecords.filter((record) => selectedSet.has(record.id))
    if (selectedRecords.length === 0) return

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const left = 12
    let y = 16

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(17)
    pdf.text('Rechnung', left, y)

    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`Erstellt: ${new Date().toLocaleString('de-DE')}`, left, y)
    y += 5
    pdf.text(`Positionen: ${selectedRecords.length}`, left, y)

    y += 7
    pdf.setFont('helvetica', 'bold')
    pdf.text('Zeit', left, y)
    pdf.text('Firma', 46, y)
    pdf.text('Typ', 95, y)
    pdf.text('Produkt', 116, y)
    pdf.text('Gesamt', 193, y, { align: 'right' })

    y += 2
    pdf.setDrawColor(180)
    pdf.line(left, y, 198, y)
    y += 5

    let totalPickup = 0
    let totalDropoff = 0

    for (const record of selectedRecords) {
      if (record.type === 'pickup') totalPickup += record.total
      if (record.type === 'dropoff') totalDropoff += record.total

      if (y > 270) {
        pdf.addPage()
        y = 16
      }

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)

      const createdAt = record.createdAt.slice(0, 16)
      const company = record.company.length > 24 ? `${record.company.slice(0, 21)}...` : record.company
      const product = record.productName.length > 36 ? `${record.productName.slice(0, 33)}...` : record.productName

      pdf.text(createdAt, left, y)
      pdf.text(company, 46, y)
      pdf.text(flowLabel(record.type), 95, y)
      pdf.text(product, 116, y)
      pdf.text(money(record.total), 193, y, { align: 'right' })

      y += 4.5

      pdf.setTextColor(100)
      pdf.text(`${record.amount} ${record.unit} x ${money(record.unitPrice)} | Status: ${record.status}`, 116, y)
      pdf.setTextColor(0)

      y += 5.5
    }

    if (y > 255) {
      pdf.addPage()
      y = 16
    }

    const net = totalPickup - totalDropoff

    pdf.setDrawColor(180)
    pdf.line(left, y, 198, y)
    y += 8

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`Summe Verkauf: ${money(totalPickup)}`, 198, y, { align: 'right' })
    y += 5
    pdf.text(`Summe Annahme: ${money(totalDropoff)}`, 198, y, { align: 'right' })
    y += 6
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(`Saldo: ${money(net)}`, 198, y, { align: 'right' })

    const stamp = toSafeFileDate(new Date().toLocaleString('de-DE'))
    pdf.save(`rechnung-markierte-eintraege-${stamp}.pdf`)
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">History</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgaenge ueber alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredRecords.length} von {records.length} Eintraegen
          </p>
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
            onClick={exportSelectedAsCsv}
            disabled={selectedCount === 0}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            CSV Export ({selectedCount})
          </button>
          <button
            type="button"
            onClick={exportSelectedAsInvoicePdf}
            disabled={selectedCount === 0}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            PDF Rechnung ({selectedCount})
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Firma
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Firmen</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>

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
              onChange={(event) => setStatusFilter(event.target.value as 'all' | RecordStatus)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Firma, Produkt, Notiz"
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
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {filteredRecords.map((record) => (
                <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">{record.createdAt}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{record.company}</p>
                      <p className="mt-1 text-sm text-slate-700">{record.productName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {flowLabel(record.type)}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Eintrag ${record.id} markieren`}
                      />
                    </div>
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
                      <dd className="font-semibold text-slate-800">{statusLabel(record.status)}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs text-slate-600">Notiz: {record.note || '-'}</p>

                  <label className="mt-3 block text-xs font-semibold text-slate-700">
                    Status
                    <select
                      value={record.status}
                      onChange={(event) => updateRecordStatus(record.id, event.target.value as RecordStatus)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-normal outline-none focus:border-slate-800"
                    >
                      {statusStages.map((stage) => (
                        <option key={stage.value} value={stage.value}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-5xl border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-2">
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
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(record.id)}
                          onChange={() => toggleRecordSelection(record.id)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Eintrag ${record.id} markieren`}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.createdAt}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{record.company}</td>
                      <td className="px-3 py-2">{flowLabel(record.type)}</td>
                      <td className="px-3 py-2">{record.productName}</td>
                      <td className="px-3 py-2">
                        {record.amount} {record.unit}
                      </td>
                      <td className="px-3 py-2">{money(record.unitPrice)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{money(record.total)}</td>
                      <td className="px-3 py-2">
                        <select
                          value={record.status}
                          onChange={(event) => updateRecordStatus(record.id, event.target.value as RecordStatus)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-slate-800"
                        >
                          {statusStages.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>
    </section>
  )
}
