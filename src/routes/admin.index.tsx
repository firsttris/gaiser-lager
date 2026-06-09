import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/confirm-dialog'
import { HistoryTable } from '../components/history-table'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordStatus, useAppState } from '../state/app-state'
import {
  createHistoryCsv,
  downloadCsvFile,
  groupByDocId,
  statusLabel,
} from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { PendingDocumentSection } from '../components/pending-document-section'

export const Route = createFileRoute('/admin/')({ component: AdminIndexPage })

function AdminIndexPage() {
  const { companies, records, updateRecordStatus, assignDeliveryNote, assignInvoice, assignCancel } = useAppState()
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
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
  const selectedHaveDeliveryNote = selectedRecords.some((r) => r.deliveryNoteId)
  const canCreateCompanyDocuments = selectedRecords.length > 0 && selectedCompanies.length === 1 && !selectedHaveDeliveryNote

  function exportSelectedAsCsv() {
    const selectedRecords = filteredRecords.filter((record) => selectedSet.has(record.id))
    if (selectedRecords.length === 0) return

    const csv = createHistoryCsv(selectedRecords, true)

    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-history-${stamp}.csv`, csv)
  }

  const pendingDeliveryNotes = useMemo(() => groupByDocId(records, 'lieferschein', 'deliveryNoteId'), [records])
  const pendingInvoices = useMemo(() => groupByDocId(records, 'rechnung', 'invoiceId'), [records])

  function createDeliveryNotes() {
    if (selectedRecords.length === 0) return
    if (selectedCompanies.length !== 1) return

    const deliveryNoteId = `LS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedRecords[0].id}`
    assignDeliveryNote(selectedRecords.map((r) => r.id), deliveryNoteId)
    selectedRecords.forEach((record) => updateRecordStatus(record.id, 'lieferschein'))
    downloadCombinedDeliveryNote(selectedRecords, selectedCompanies[0], deliveryNoteId)
  }

  function exportSelectedAsInvoicePdf() {
    if (selectedRecords.length === 0) return
    if (selectedCompanies.length !== 1) return

    const shortCode = companies.find((c) => c.name === selectedCompanies[0])?.shortCode
    const invoiceNo = downloadInvoicePdf(selectedRecords, shortCode)
    selectedRecords.forEach((record) => updateRecordStatus(record.id, 'rechnung'))
    assignInvoice(selectedRecords.map((r) => r.id), invoiceNo)
  }

  function createInvoiceForDeliveryNote(deliveryNoteId: string, invoiceRecords: typeof records) {
    const shortCode = companies.find((c) => c.name === invoiceRecords[0].company)?.shortCode
    const invoiceNo = downloadInvoicePdf(invoiceRecords, shortCode, deliveryNoteId)
    invoiceRecords.forEach((record) => updateRecordStatus(record.id, 'rechnung'))
    assignInvoice(invoiceRecords.map((r) => r.id), invoiceNo)
  }

  function cancelDeliveryNoteGroup(items: typeof records) {
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function cancelGroup(items: typeof records) {
    const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items[0].id}`
    const originalDocId = items[0].invoiceId ?? items[0].deliveryNoteId
    downloadStornoDoc(items, items[0].company, cancelId, originalDocId)
    assignCancel(items.map((r) => r.id), cancelId)
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function handleDeliveryNoteClick(deliveryNoteId: string) {
    const group = records.filter((r) => r.deliveryNoteId === deliveryNoteId)
    if (group.length === 0) return
    downloadCombinedDeliveryNote(group, group[0].company, deliveryNoteId)
  }

  function handleInvoiceClick(invoiceId: string) {
    const group = records.filter((r) => r.invoiceId === invoiceId)
    if (group.length === 0) return
    const shortCode = companies.find((c) => c.name === group[0].company)?.shortCode
    downloadInvoicePdf(group, shortCode, group[0].deliveryNoteId, invoiceId)
  }

  function handleCancelClick(cancelId: string) {
    const group = records.filter((r) => r.cancelId === cancelId)
    if (group.length === 0) return
    downloadStornoDoc(group, group[0].company, cancelId, group[0].invoiceId ?? group[0].deliveryNoteId)
  }

  return (
    <section className="space-y-5">
      {pendingInvoices.length > 0 && (
        <PendingDocumentSection
          title="Offene Rechnungen"
          subtitle="Rechnungen, die noch nicht als bezahlt markiert wurden."
          groups={pendingInvoices}
          variant="blue"
          showCompany
          renderActions={(_id, items) => (
            <>
              <button
                type="button"
                onClick={() => setPendingAction({
                  action: () => cancelGroup(items),
                  title: 'Rechnung stornieren',
                  message: `Sind Sie sicher, dass Sie diese Rechnung (${items.length} Eintrag/Einträge) stornieren möchten?`,
                })}
                className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                Stornieren
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({
                  action: () => items.forEach((r) => updateRecordStatus(r.id, 'bezahlt')),
                  title: 'Als bezahlt markieren',
                  message: `Sind Sie sicher, dass Sie diese Rechnung (${items.length} Eintrag/Einträge) als bezahlt markieren möchten?`,
                })}
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Als bezahlt markieren
              </button>
            </>
          )}
        />
      )}

      {pendingDeliveryNotes.length > 0 && (
        <PendingDocumentSection
          title="Offene Lieferscheine"
          subtitle="Lieferscheine, fuer die noch keine Rechnung erstellt wurde."
          groups={pendingDeliveryNotes}
          variant="amber"
          showCompany
          renderActions={(id, items) => (
            <>
              <button
                type="button"
                onClick={() => setPendingAction({
                  action: () => cancelDeliveryNoteGroup(items),
                  title: 'Lieferschein stornieren',
                  message: `Sind Sie sicher, dass Sie diesen Lieferschein (${items.length} Eintrag/Einträge) stornieren möchten?`,
                })}
                className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                Stornieren
              </button>
              <button
                type="button"
                onClick={() => downloadCombinedDeliveryNote(items, items[0].company, id)}
                className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Lieferschein herunterladen
              </button>
              <button
                type="button"
                onClick={() => createInvoiceForDeliveryNote(id, items)}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Rechnung erstellen
              </button>
            </>
          )}
        />
      )}

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Historie</h2>
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
            Lieferschein erstellen ({selectedCount})
          </button>
          <button
            type="button"
            onClick={exportSelectedAsInvoicePdf}
            disabled={!canCreateCompanyDocuments}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Rechnung erstellen ({selectedCount})
          </button>
        </div>

        {selectedCount > 0 && !canCreateCompanyDocuments && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            {selectedHaveDeliveryNote
              ? 'Einige markierte Eintraege gehoeren bereits zu einem Lieferschein. Neue Dokumente koennen nur fuer Eintraege ohne bestehenden Lieferschein erstellt werden.'
              : 'Lieferschein und Rechnung sind nur moeglich, wenn alle markierten Eintraege zur gleichen Firma gehoeren.'}
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
            onDeliveryNoteClick={handleDeliveryNoteClick}
            onInvoiceClick={handleInvoiceClick}
            onCancelClick={handleCancelClick}
          />
        )}
      </article>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmLabel="Ja"
        onConfirm={() => { pendingAction?.action(); setPendingAction(null) }}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  )
}
