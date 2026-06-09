import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HistoryTable, shortDocId } from '../components/history-table'
import { PageShell } from '../components/page-shell'
import { useRecordSelection } from '../hooks/use-record-selection'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { createHistoryCsv, downloadCsvFile, groupByDocId } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { PendingDocumentSection } from '../components/pending-document-section'
import { RecordActionsBar } from '../components/record-actions-bar'

export const Route = createFileRoute('/history')({ component: HistoryPage })

function HistoryPage() {
  const { isLoggedIn, records, selectedCompany, updateRecordStatus, assignDeliveryNote } = useAppState()
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')

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

      const haystack = `${record.note} ${shortDocId(record.deliveryNoteId ?? '')} ${shortDocId(record.invoiceId ?? '')} ${shortDocId(record.cancelId ?? '')}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyRecords, searchText, statusFilter, typeFilter])

  const pendingInvoices = useMemo(() => groupByDocId(companyRecords, 'rechnung', 'invoiceId'), [companyRecords])
  const pendingDeliveryNotes = useMemo(() => groupByDocId(companyRecords, 'lieferschein', 'deliveryNoteId'), [companyRecords])

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

  const selectedHaveDeliveryNote = selectedRecords.some((r) => r.deliveryNoteId)
  const canCreateDeliveryNote = selectedCount > 0 && !selectedHaveDeliveryNote

  function createCombinedDeliveryNote() {
    if (!canCreateDeliveryNote) return

    const deliveryNoteId = `LS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedRecords[0].id}`
    assignDeliveryNote(selectedRecords.map((r) => r.id), deliveryNoteId)
    selectedRecords.forEach((r) => updateRecordStatus(r.id, 'lieferschein'))
    downloadCombinedDeliveryNote(selectedRecords, selectedCompany?.name ?? '', deliveryNoteId)
  }

  function handleDeliveryNoteClick(deliveryNoteId: string) {
    const group = companyRecords.filter((r) => r.deliveryNoteId === deliveryNoteId)
    if (group.length === 0) return
    downloadCombinedDeliveryNote(group, selectedCompany?.name ?? '', deliveryNoteId)
  }

  function handleInvoiceClick(invoiceId: string) {
    const group = companyRecords.filter((r) => r.invoiceId === invoiceId)
    if (group.length === 0) return
    downloadInvoicePdf(group, selectedCompany?.shortCode, group[0].deliveryNoteId, invoiceId)
  }

  function handleCancelClick(cancelId: string) {
    const group = companyRecords.filter((r) => r.cancelId === cancelId)
    if (group.length === 0) return
    downloadStornoDoc(group, selectedCompany?.name ?? '', cancelId, group[0].invoiceId ?? group[0].deliveryNoteId)
  }

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return

    const csv = createHistoryCsv(selectedRecords, false)
    const stamp = new Date().toISOString().slice(0, 10)
    const company = selectedCompany?.shortCode?.toLowerCase() ?? 'kunde'
    downloadCsvFile(`history-${company}-${stamp}.csv`, csv)
  }

  if (!isLoggedIn) {
    return (
      <PageShell>
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
      </PageShell>
    )
  }

  return (
    <PageShell>
      <TopNav />

      <div className="space-y-5">
      {pendingInvoices.length > 0 && (
        <PendingDocumentSection
          title="Offene Rechnungen"
          subtitle="Rechnungen, die noch nicht als bezahlt markiert wurden."
          groups={pendingInvoices}
          variant="blue"
          renderActions={(id, items) => (
            <button
              type="button"
              onClick={() => downloadInvoicePdf(items, selectedCompany?.shortCode, items[0].deliveryNoteId, id)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Rechnung herunterladen
            </button>
          )}
        />
      )}

      {pendingDeliveryNotes.length > 0 && (
        <PendingDocumentSection
          title="Offene Lieferscheine"
          subtitle="Lieferscheine, fuer die noch keine Rechnung erstellt wurde."
          groups={pendingDeliveryNotes}
          variant="amber"
          renderActions={(id, items) => (
            <button
              type="button"
              onClick={() => downloadCombinedDeliveryNote(items, selectedCompany?.name ?? '', id)}
              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Lieferschein herunterladen
            </button>
          )}
        />
      )}

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
              placeholder="Notiz, LS-/RG-/ST-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
        </div>

        <RecordActionsBar
          selectedCount={selectedCount}
          canCreateDeliveryNote={canCreateDeliveryNote}
          selectedHaveDeliveryNote={selectedHaveDeliveryNote}
          onSelectAll={selectAllVisible}
          onClearSelection={clearSelection}
          onCreateDeliveryNote={createCombinedDeliveryNote}
          onExportCsv={exportSelectedAsCsv}
        />

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
            onDeliveryNoteClick={handleDeliveryNoteClick}
            onInvoiceClick={handleInvoiceClick}
            onCancelClick={handleCancelClick}
          />
        )}
      </section>
      </div>
    </PageShell>
  )
}
