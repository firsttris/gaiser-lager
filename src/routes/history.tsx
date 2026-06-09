import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HistoryTable } from '../components/history-table'
import { PageShell } from '../components/page-shell'
import { useRecordSelection } from '../hooks/use-record-selection'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { createHistoryCsv, downloadCsvFile, money } from '../utils/history-utils'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'

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

      const haystack = `${record.productName} ${record.note} ${record.status}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyRecords, searchText, statusFilter, typeFilter])

  const pendingDeliveryNotes = useMemo(() => {
    const byId = new Map<string, typeof companyRecords>()
    for (const record of companyRecords) {
      if (record.status === 'lieferschein' && record.deliveryNoteId) {
        const group = byId.get(record.deliveryNoteId) ?? []
        group.push(record)
        byId.set(record.deliveryNoteId, group)
      }
    }
    return Array.from(byId.entries())
      .map(([id, items]) => ({ id, items }))
      .sort((a, b) => b.id.localeCompare(a.id))
  }, [companyRecords])

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
    selectedRecords.forEach((record) => updateRecordStatus(record.id, 'lieferschein'))
    downloadCombinedDeliveryNote(selectedRecords, selectedCompany?.name ?? '', deliveryNoteId)
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

      {pendingDeliveryNotes.length > 0 && (
        <article className="rounded-2xl border border-amber-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h2 className="font-title text-2xl text-slate-900">Offene Lieferscheine</h2>
          <p className="mt-1 text-sm text-slate-600">Lieferscheine, fuer die noch keine Rechnung erstellt wurde.</p>
          <div className="mt-4 space-y-2">
            {pendingDeliveryNotes.map(({ id, items }) => {
              const total = items.reduce((sum, r) => sum + r.total, 0)
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{id}</p>
                    <p className="text-xs text-slate-600">
                      {items.length} Position{items.length !== 1 ? 'en' : ''} &middot; {money(total)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadCombinedDeliveryNote(items, selectedCompany?.name ?? '', id)}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Lieferschein herunterladen
                  </button>
                </div>
              )
            })}
          </div>
        </article>
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
              placeholder="Produkt, Notiz"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
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
            disabled={!canCreateDeliveryNote}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lieferschein erstellen ({selectedCount})
          </button>
          <button
            type="button"
            onClick={exportSelectedAsCsv}
            disabled={selectedCount === 0}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            CSV Export ({selectedCount})
          </button>
        </div>

        {selectedCount > 0 && selectedHaveDeliveryNote && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Einige markierte Eintraege gehoeren bereits zu einem Lieferschein und koennen nicht erneut verwendet werden.
          </p>
        )}

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
          />
        )}
      </section>
    </PageShell>
  )
}
