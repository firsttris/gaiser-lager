import { createFileRoute } from '@tanstack/react-router'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet, Receipt } from 'lucide-react'
import { HistoryTable } from '../components/history-table'
import { PageShell } from '../components/page-shell'
import { Pagination } from '../components/pagination'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useRecordSelection } from '../hooks/use-record-selection'
import { TopNav } from '../components/top-nav'
import { type RecordStatus, useAppState } from '../state/app-state'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { companyFilenameSegment, createHistoryCsv, downloadCsvFile, statusStages } from '../utils/history-utils'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { downloadCancellationPdf, downloadInvoicePdf } from '../utils/invoice-download'
import { berlinIsoDate } from '../utils/berlin-time'
import { countAllRecords, listRecordsByDocId, listRecordsPage } from '../server/records'
import { SelectionActionBar } from '../components/selection-action-bar'
import { SelectInput } from '../components/select-input'
import { TableSkeleton } from '../components/table-skeleton'

const DEFAULT_PAGE_SIZE = 25

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle Typen' },
  { value: 'dropoff', label: 'Annahme' },
  { value: 'pickup', label: 'Verkauf' },
  { value: 'lkw', label: 'LKW' },
]

export const Route = createFileRoute('/kunde/vorgaenge')({ component: HistoryPage })

function HistoryPage() {
  const { isLoggedIn, selectedCompany } = useAppState()
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff' | 'lkw'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchText.trim(), 300)
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateRange)

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, debouncedSearch, dateFrom, dateTo, pageSize])

  const filters = {
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
    enabled: isLoggedIn,
  })
  const totalCountQuery = useQuery({ queryKey: ['records', 'count'] as const, queryFn: () => countAllRecords(), enabled: isLoggedIn })

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

  async function handleDeliveryNoteClick(deliveryNoteId: string) {
    setDownloadingDocId(deliveryNoteId)
    try {
      const group = await listRecordsByDocId({ data: { field: 'delivery_note_id', value: deliveryNoteId } })
      if (group.length === 0) return
      await downloadCombinedDeliveryNote(group, selectedCompany?.name ?? '', deliveryNoteId, selectedCompany ?? undefined)
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
    if (group.length === 0) return
    await downloadCancellationPdf(group, selectedCompany ?? undefined)
  }

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return

    const csv = createHistoryCsv(selectedRecords, false)
    const stamp = berlinIsoDate()
    const company = companyFilenameSegment(selectedCompany?.name)
    downloadCsvFile(`history-${company}-${stamp}.csv`, csv)
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

  return (
    <PageShell>
      <TopNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-title text-4xl text-slate-900">Vorgänge</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgänge für {selectedCompany?.name}.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredCount} von {totalCountQuery.data ?? filteredCount} Einträgen
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
              onChange={(event) => setSearchText(event.target.value)}
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
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              icon: <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />,
              onClick: exportSelectedAsCsv,
            },
            {
              label: 'Lieferschein',
              icon: <FileDown className="h-4 w-4" strokeWidth={2.25} />,
              disabled: selectedDeliveryNoteIds.length === 0,
              onClick: () => void downloadSelectedDeliveryNotes(),
            },
            {
              label: 'Rechnung',
              icon: <Receipt className="h-4 w-4" strokeWidth={2.25} />,
              disabled: selectedInvoiceIds.length === 0,
              onClick: () => void downloadSelectedInvoices(),
            },
          ]}
        />

        {recordsQuery.isLoading ? (
          <TableSkeleton />
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
              onDeliveryNoteClick={(id) => void handleDeliveryNoteClick(id)}
              onInvoiceClick={(id) => void handleInvoiceClick(id)}
              onCancelClick={(id) => void handleCancelClick(id)}
              downloadingDocId={downloadingDocId}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalCount={filteredCount} pageSize={pageSize} onPageSizeChange={setPageSize} />
          </>
        )}
      </section>
    </PageShell>
  )
}
