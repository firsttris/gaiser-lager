import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, FilePlus, FileDown, FileSpreadsheet, Receipt } from 'lucide-react'
import { ConfirmDialog } from '../components/confirm-dialog'
import { HistoryTable } from '../components/history-table'
import { Pagination } from '../components/pagination'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordStatus, useAppState } from '../state/app-state'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { createHistoryCsv, downloadCsvFile, money, statusStages } from '../utils/history-utils'
import { berlinIsoDate } from '../utils/berlin-time'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { downloadCancellationPdf, downloadInvoicePdf } from '../utils/invoice-download'
import { countAllRecords, listRecordsByDocId, listRecordsPage } from '../server/records'
import { Spinner } from '../components/spinner'
import { SelectInput } from '../components/select-input'

const DEFAULT_PAGE_SIZE = 25

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle Typen' },
  { value: 'dropoff', label: 'Annahme' },
  { value: 'pickup', label: 'Verkauf' },
  { value: 'lkw', label: 'LKW' },
]

export const Route = createFileRoute('/admin/vorgaenge')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminVorgaengePage,
})

function AdminVorgaengePage() {
  const { companies, createInvoice, cancelRecords } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff' | 'lkw'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pendingAction, setPendingAction] = useState<{ action: () => Promise<void>; title: string; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sammelrechnungOpen, setSammelrechnungOpen] = useState(false)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const companyOptions = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [companies],
  )
  const companyId = companyFilter === 'all' ? undefined : companyFilter
  const companyById = (id: string) => companies.find((c) => c.id === id)

  const debouncedSearch = useDebouncedValue(searchText.trim(), 300)
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateRange)

  useEffect(() => {
    setPage(1)
  }, [companyId, typeFilter, statusFilter, debouncedSearch, dateFrom, dateTo, pageSize])

  const filters = {
    companyId,
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    dateFrom,
    dateTo,
  }

  const recordsQuery = useQuery({
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
    queryKey: ['records', filters, page, pageSize] as const,
    queryFn: () => listRecordsPage({ data: { ...filters, page, pageSize } }),
    placeholderData: keepPreviousData,
  })
  const totalCountQuery = useQuery({ queryKey: ['records', 'count'] as const, queryFn: () => countAllRecords() })

  const pageRecords = recordsQuery.data?.records ?? []
  const filteredCount = recordsQuery.data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize))

  const {
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
    clearSelection,
  } = useRecordSelection(pageRecords)

  const selectedTotal = selectedRecords.reduce((sum, r) => sum + r.total, 0)
  const selectedCompanyIds = Array.from(new Set(selectedRecords.map((r) => r.companyId)))
  const selectedAllOpenLieferschein = selectedRecords.length > 0 && selectedRecords.every((r) => r.status === 'lieferschein')
  const canCreateInvoice = selectedAllOpenLieferschein && selectedCompanyIds.length === 1
  const canStorno = selectedAllOpenLieferschein

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return
    const csv = createHistoryCsv(selectedRecords, true)
    downloadCsvFile(`admin-history-${berlinIsoDate()}.csv`, csv)
  }

  const selectedDeliveryNoteIds = [...new Set(selectedRecords.map((r) => r.deliveryNoteId).filter((id): id is string => Boolean(id)))]
  const selectedInvoiceIds = [...new Set(selectedRecords.map((r) => r.invoiceId).filter((id): id is string => Boolean(id)))]

  async function downloadSelectedDeliveryNotes() {
    for (const id of selectedDeliveryNoteIds) {
      await handleDeliveryNoteClick(id)
    }
  }

  async function downloadSelectedInvoices() {
    for (const id of selectedInvoiceIds) {
      await handleInvoiceClick(id)
    }
  }

  // Each selected delivery note record is cancelled on its own (one Storno
  // document per record). The PDF is only generated once the cancellation is
  // stored, from the records as the database now has them.
  async function stornoSelection() {
    const failures: string[] = []
    for (const record of selectedRecords) {
      const result = await cancelRecords([record.id])
      if (!result.ok) {
        failures.push(`${record.deliveryNoteId ?? `#${record.id}`}: ${result.message}`)
        continue
      }
      await handleCancelClick(result.documentId)
    }
    clearSelection()
    setActionError(failures.length ? `Nicht storniert: ${failures.join('; ')}` : null)
  }

  async function createSammelrechnung() {
    if (!canCreateInvoice) return
    const result = await createInvoice(selectedRecords.map((r) => r.id))
    if (!result.ok) {
      setActionError(result.message)
      return
    }
    setActionError(null)
    clearSelection()
    await handleInvoiceClick(result.documentId)
  }

  async function handleDeliveryNoteClick(deliveryNoteId: string) {
    setDownloadingDocId(deliveryNoteId)
    try {
      const group = await listRecordsByDocId({ data: { field: 'delivery_note_id', value: deliveryNoteId } })
      if (!group.length) return
      await downloadCombinedDeliveryNote(group, group[0].company, deliveryNoteId, companyById(group[0].companyId))
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function handleInvoiceClick(invoiceId: string) {
    setDownloadingDocId(invoiceId)
    try {
      await downloadInvoicePdf(invoiceId)
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function handleCancelClick(cancelId: string) {
    const group = await listRecordsByDocId({ data: { field: 'cancel_id', value: cancelId } })
    if (!group.length) return
    await downloadCancellationPdf(group, companyById(group[0].companyId))
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Vorgänge</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgänge über alle Firmen.</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {filteredCount} von {totalCountQuery.data ?? filteredCount} Einträgen
            </p>
            <Link
              to="/admin/neuer-vorgang"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-slate-800"
            >
              Neuer Vorgang
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">
            Firma
            <SelectInput
              value={companyFilter}
              onChange={setCompanyFilter}
              options={[{ value: 'all', label: 'Alle Firmen' }, ...companyOptions.map((company) => ({ value: company.id, label: company.name }))]}
              className="mt-2 w-full min-h-12 px-3 py-2 font-normal"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Typ
            <SelectInput
              value={typeFilter}
              onChange={(type) => setTypeFilter(type as 'all' | 'pickup' | 'dropoff' | 'lkw')}
              options={TYPE_FILTER_OPTIONS}
              className="mt-2 w-full min-h-12 px-3 py-2 font-normal"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Status
            <SelectInput
              value={statusFilter}
              onChange={(status) => setStatusFilter(status as 'all' | RecordStatus)}
              options={[{ value: 'all', label: 'Alle Status' }, ...statusStages]}
              className="mt-2 w-full min-h-12 px-3 py-2 font-normal"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Baustelle, LS-/RG-/ST-Nummer"
              className="mt-2 w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        <SelectionActionBar
          count={selectedCount}
          noun="Eintrag"
          pluralLabel="Einträge"
          total={selectedTotal}
          warning={
            selectedAllOpenLieferschein && selectedCompanyIds.length > 1
              ? 'Rechnung ist nur möglich, wenn alle markierten Einträge zur gleichen Firma gehören.'
              : undefined
          }
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              icon: <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2.25} />,
              onClick: exportSelectedAsCsv,
            },
            {
              label: 'Lieferschein',
              icon: <FileDown className="h-3.5 w-3.5" strokeWidth={2.25} />,
              disabled: selectedDeliveryNoteIds.length === 0,
              onClick: () => void downloadSelectedDeliveryNotes(),
            },
            {
              label: 'Rechnung',
              icon: <Receipt className="h-3.5 w-3.5" strokeWidth={2.25} />,
              disabled: selectedInvoiceIds.length === 0,
              onClick: () => void downloadSelectedInvoices(),
            },
            {
              label: 'Stornieren',
              icon: <Ban className="h-3.5 w-3.5" strokeWidth={2.25} />,
              disabled: !canStorno,
              onClick: () => setPendingAction({
                action: stornoSelection,
                title: 'Lieferscheine stornieren',
                message: `Sind Sie sicher, dass Sie ${selectedRecords.length} ${selectedRecords.length === 1 ? 'Eintrag' : 'Einträge'} stornieren möchten?`,
              }),
            },
            {
              label: 'Rechnung erstellen',
              icon: <FilePlus className="h-3.5 w-3.5" strokeWidth={2.25} />,
              variant: 'primary',
              disabled: !canCreateInvoice,
              onClick: () => setSammelrechnungOpen(true),
            },
          ]}
        />

        {actionError && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{actionError}</p>
        )}

        {recordsQuery.isLoading ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Lädt…</p>
        ) : pageRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Einträge für die aktuellen Filter vorhanden.
          </p>
        ) : (
          <>
            <HistoryTable
              records={pageRecords}
              selectedSet={selectedSet}
              areAllVisibleSelected={areAllVisibleSelected}
              onSelectAll={(checked) => (checked ? selectAllVisible() : deselectVisible())}
              onToggle={toggleRecordSelection}
              showCompanyColumn
              onDeliveryNoteClick={(id) => void handleDeliveryNoteClick(id)}
              onInvoiceClick={(id) => void handleInvoiceClick(id)}
              onCancelClick={(id) => void handleCancelClick(id)}
              downloadingDocId={downloadingDocId}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalCount={filteredCount} pageSize={pageSize} onPageSizeChange={setPageSize} />
          </>
        )}
      </article>

      {sammelrechnungOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSammelrechnungOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900">Rechnung erstellen</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selectedRecords.length} {selectedRecords.length === 1 ? 'Eintrag' : 'Einträge'} für {selectedRecords[0]?.company} · {money(selectedTotal)}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSammelrechnungOpen(false)}
                disabled={isCreatingInvoice}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsCreatingInvoice(true)
                  try {
                    await createSammelrechnung()
                    setSammelrechnungOpen(false)
                  } finally {
                    setIsCreatingInvoice(false)
                  }
                }}
                disabled={isCreatingInvoice}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingInvoice && <Spinner className="h-4 w-4" />}
                Rechnung erstellen
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmLabel="Ja"
        onConfirm={() => { void pendingAction?.action(); setPendingAction(null) }}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  )
}
