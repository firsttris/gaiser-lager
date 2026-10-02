import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { HistoryTable } from '../components/history-table'
import { RecordPhotosDialog } from '../components/record-photos-dialog'
import { Pagination } from '../components/pagination'
import { SelectionActionBar } from '../components/selection-action-bar'
import { SelectInput } from '../components/select-input'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordItem, type RecordStatus } from '../state/app-state'
import { countAllRecords, listRecordsByDocId, listRecordsPage } from '../server/records'
import { getCompanyForBooking } from '../server/companies'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { createHistoryCsv, downloadCsvFile, statusStages } from '../utils/history-utils'
import { berlinIsoDate } from '../utils/berlin-time'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'
import { TableSkeleton } from '../components/table-skeleton'

export const Route = createFileRoute('/mitarbeiter/buchungen')({ component: EmployeeBookingsPage })

const DEFAULT_PAGE_SIZE = 25

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle Typen' },
  { value: 'dropoff', label: 'Annahme' },
  { value: 'pickup', label: 'Verkauf' },
  { value: 'lkw', label: 'LKW' },
]

// What this driver booked (the server only returns their own records) — the
// same list, filters and actions as the other Vorgänge pages.
function EmployeeBookingsPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff' | 'lkw'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [photosRecord, setPhotosRecord] = useState<RecordItem | null>(null)

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
    queryKey: ['records', 'employee', filters, page, pageSize] as const,
    queryFn: () => listRecordsPage({ data: { ...filters, page, pageSize } }),
    placeholderData: keepPreviousData,
  })
  const totalCountQuery = useQuery({ queryKey: ['records', 'employee', 'count'] as const, queryFn: () => countAllRecords() })

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
  const selectedDeliveryNoteIds = [...new Set(selectedRecords.map((r) => r.deliveryNoteId).filter((id): id is string => Boolean(id)))]

  async function downloadDeliveryNote(deliveryNoteId: string) {
    setDownloadingDocId(deliveryNoteId)
    try {
      const group = await listRecordsByDocId({ data: { field: 'delivery_note_id', value: deliveryNoteId } })
      if (!group.length) return
      const customer = await getCompanyForBooking({ data: { id: group[0].companyId } })
      await downloadCombinedDeliveryNote(group, group[0].company, deliveryNoteId, customer ?? undefined)
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function downloadSelectedDeliveryNotes() {
    for (const id of selectedDeliveryNoteIds) await downloadDeliveryNote(id)
  }

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return
    downloadCsvFile(`meine-buchungen-${berlinIsoDate()}.csv`, createHistoryCsv(selectedRecords, true))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-title text-4xl text-slate-900">Meine Buchungen</h2>
          <p className="mt-1 text-sm text-slate-600">Alle Vorgänge, die du gebucht hast. Lieferschein antippen zum Herunterladen.</p>
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
            placeholder="Kunde, Baustelle, LS-Nummer"
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
        ]}
      />

      {recordsQuery.isLoading ? (
        <TableSkeleton />
      ) : pageRecords.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">Keine Buchungen für die aktuellen Filter.</p>
      ) : (
        <>
          <HistoryTable
            records={pageRecords}
            selectedSet={selectedSet}
            areAllVisibleSelected={areAllVisibleSelected}
            onSelectAll={(checked) => (checked ? selectAllVisible() : deselectVisible())}
            onToggle={toggleRecordSelection}
            showCompanyColumn
            onDeliveryNoteClick={(id) => void downloadDeliveryNote(id)}
            downloadingDocId={downloadingDocId}
            onPhotosClick={setPhotosRecord}
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            totalCount={filteredCount}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
      <RecordPhotosDialog record={photosRecord} onClose={() => setPhotosRecord(null)} />
    </section>
  )
}
