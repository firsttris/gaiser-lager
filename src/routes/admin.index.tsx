import { createFileRoute } from '@tanstack/react-router'
import { jsPDF } from 'jspdf'
import { useMemo, useState } from 'react'
import { HistoryTable } from '../components/history-table'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordStatus, useAppState } from '../state/app-state'
import {
  createHistoryCsv,
  downloadCsvFile,
  flowLabel,
  money,
  statusLabel,
} from '../utils/history-utils'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'

export const Route = createFileRoute('/admin/')({ component: AdminIndexPage })

function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function AdminIndexPage() {
  const { companies, records, updateRecordStatus } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')

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

  const {
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
    clearSelection,
  } = useRecordSelection(filteredRecords)

  const selectedCompanies = Array.from(new Set(selectedRecords.map((record) => record.company)))
  const canCreateCompanyDocuments = selectedRecords.length > 0 && selectedCompanies.length === 1

  function exportSelectedAsCsv() {
    const selectedRecords = filteredRecords.filter((record) => selectedSet.has(record.id))
    if (selectedRecords.length === 0) return

    const csv = createHistoryCsv(selectedRecords, true)

    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-history-${stamp}.csv`, csv)
  }

  function createDeliveryNotes() {
    if (selectedRecords.length === 0) return
    if (selectedCompanies.length !== 1) return

    downloadCombinedDeliveryNote(selectedRecords, selectedCompanies[0])
    selectedRecords.forEach((record) => updateRecordStatus(record.id, 'lieferschein'))
  }

  function exportSelectedAsInvoicePdf() {
    if (selectedRecords.length === 0) return
    if (selectedCompanies.length !== 1) return

    const customerName = selectedCompanies[0]
    const customer = companies.find((company) => company.name === customerName)

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const left = 12
    const right = 198
    let y = 16

    const invoiceNo = `RG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedRecords[0].id}`

    pdf.setDrawColor(220)
    pdf.setFillColor(248, 250, 252)
    pdf.roundedRect(left, y, 186, 26, 2, 2, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)
    pdf.text('RECHNUNG', left + 4, y + 9)
    pdf.setFontSize(11)
    pdf.text('Gaiser Baustoffe', left + 4, y + 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Musterstrasse 1, 10115 Berlin', left + 4, y + 21)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(`Nr.: ${invoiceNo}`, right - 4, y + 10, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, right - 4, y + 16, { align: 'right' })
    pdf.text(`Positionen: ${selectedRecords.length}`, right - 4, y + 21, { align: 'right' })

    y += 36

    pdf.setDrawColor(225)
    pdf.roundedRect(left, y, 120, 24, 2, 2)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Rechnungsadresse', left + 3, y + 6)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(customerName, left + 3, y + 11)
    if (customer?.shortCode) {
      pdf.text(`Kuerzel: ${customer.shortCode}`, left + 3, y + 16)
    }
    pdf.text('z. Hd. Buchhaltung', left + 3, y + 21)

    y += 40

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(
      `Leistungszeitraum: ${selectedRecords[0].createdAt} bis ${selectedRecords[selectedRecords.length - 1].createdAt}`,
      left,
      y,
    )

    y += 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFillColor(241, 245, 249)
    pdf.rect(left, y - 4.5, 186, 7.5, 'F')
    pdf.text('Pos.', left, y)
    pdf.text('Datum', 24, y)
    pdf.text('Leistung', 56, y)
    pdf.text('Menge', 132, y)
    pdf.text('EP', 158, y)
    pdf.text('Betrag', right, y, { align: 'right' })

    y += 3
    pdf.setDrawColor(190)
    pdf.line(left, y, right, y)
    y += 7

    let subtotal = 0

    for (const [index, record] of selectedRecords.entries()) {
      subtotal += record.total

      if (y > 270) {
        pdf.addPage()
        y = 20
      }

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)

      const createdAt = record.createdAt.slice(0, 10)
      const service = `${flowLabel(record.type)}: ${record.productName}`
      const serviceShort = service.length > 40 ? `${service.slice(0, 37)}...` : service

      pdf.text(String(index + 1), left, y)
      pdf.text(createdAt, 24, y)
      pdf.text(serviceShort, 56, y)
      pdf.text(`${record.amount} ${record.unit}`, 132, y)
      pdf.text(money(record.unitPrice), 158, y)
      pdf.text(money(record.total), right, y, { align: 'right' })

      y += 4

      pdf.setDrawColor(235)
      pdf.line(left, y, right, y)

      y += 6
    }

    if (y > 210) {
      pdf.addPage()
    }

    const vat = subtotal * 0.19
    const gross = subtotal + vat
    const summaryBoxWidth = 72
    const summaryBoxX = 126
    const summaryTop = 236

    pdf.setDrawColor(220)
    pdf.roundedRect(summaryBoxX, summaryTop, summaryBoxWidth, 24, 2, 2)
    y = summaryTop + 7

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text('Zwischensumme (netto):', summaryBoxX + 3, y)
    pdf.text(money(subtotal), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
    y += 5
    pdf.text('zzgl. 19% USt.:', summaryBoxX + 3, y)
    pdf.text(money(vat), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
    y += 6
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Rechnungsbetrag:', summaryBoxX + 3, y)
    pdf.text(money(gross), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })

    y += 14
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Zahlbar ohne Abzug innerhalb von 14 Tagen.', left, y)
    y += 5
    pdf.text('Vielen Dank fuer Ihren Auftrag.', left, y)

    const stamp = toSafeFileDate(new Date().toLocaleString('de-DE'))
    pdf.save(`rechnung-${customer?.shortCode ?? 'kunde'}-${stamp}.pdf`)
    selectedRecords.forEach((record) => updateRecordStatus(record.id, 'rechnung'))
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
            onClick={createDeliveryNotes}
            disabled={!canCreateCompanyDocuments}
            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lieferschein ({selectedCount})
          </button>
          <button
            type="button"
            onClick={exportSelectedAsInvoicePdf}
            disabled={!canCreateCompanyDocuments}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            PDF Rechnung ({selectedCount})
          </button>
        </div>

        {selectedCount > 0 && !canCreateCompanyDocuments && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Lieferschein und Rechnung sind nur moeglich, wenn alle markierten Eintraege zur gleichen Firma gehoeren.
          </p>
        )}

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

        {filteredRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Eintraege fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <HistoryTable
            records={filteredRecords}
            selectedSet={selectedSet}
            areAllVisibleSelected={areAllVisibleSelected}
            onSelectAll={(checked) => (checked ? selectAllVisible() : deselectVisible())}
            onToggle={toggleRecordSelection}
            showCompanyColumn
            onStatusChange={updateRecordStatus}
          />
        )}
      </article>
    </section>
  )
}
