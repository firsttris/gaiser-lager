import { createFileRoute, Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FileSpreadsheet, Receipt } from 'lucide-react'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { DocLinkButton } from '../components/doc-link-button'
import { DocumentListTable } from '../components/document-list-table'
import { PageShell } from '../components/page-shell'
import { Pagination } from '../components/pagination'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useGroupSelection } from '../hooks/use-group-selection'
import { TopNav } from '../components/top-nav'
import { type RecordItem, useAppState } from '../state/app-state'
import { downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { berlinIsoDate } from '../utils/berlin-time'
import { companyFilenameSegment, createHistoryCsv, downloadCsvFile, invoiceBadge, reverseChargeExtraBadges } from '../utils/history-utils'
import { countAllInvoiceGroups, listInvoiceGroupsPage } from '../server/invoices'

const DEFAULT_PAGE_SIZE = 25

export const Route = createFileRoute('/kunde/rechnungen')({ component: RechnungenPage })

function RechnungenPage() {
  const { isLoggedIn, selectedCompany } = useAppState()
  const [statusFilter, setStatusFilter] = useState<'all' | 'offen' | 'bezahlt' | 'storniert'>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchText.trim(), 300)
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateRange)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, debouncedSearch, dateFrom, dateTo, pageSize])

  const filters = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    dateFrom,
    dateTo,
  }

  const groupsQuery = useQuery({
    queryKey: ['invoice-groups', filters, page, pageSize] as const,
    queryFn: () => listInvoiceGroupsPage({ data: { ...filters, page, pageSize } }),
    placeholderData: keepPreviousData,
    enabled: isLoggedIn,
  })
  const totalCountQuery = useQuery({ queryKey: ['invoice-groups', 'count'] as const, queryFn: () => countAllInvoiceGroups(), enabled: isLoggedIn })

  const pageGroups = groupsQuery.data?.groups ?? []
  const filteredCount = groupsQuery.data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize))

  const { selectedIds, selectedGroups, selectedTotal, toggleSelection, selectAllVisible, deselectVisible, clearSelection } = useGroupSelection(pageGroups)

  const areAllVisibleSelected = pageGroups.length > 0 && pageGroups.every((g) => selectedIds.has(g.id))

  function exportSelectedAsCsv() {
    if (selectedGroups.length === 0) return
    const csv = createHistoryCsv(selectedGroups.flatMap((g) => g.items), false)
    const stamp = berlinIsoDate()
    const company = companyFilenameSegment(selectedCompany?.name)
    downloadCsvFile(`rechnungen-${company}-${stamp}.csv`, csv)
  }

  async function handleInvoiceDownload(id: string, items: RecordItem[], deliveryNoteRefs: string) {
    setDownloadingDocId(id)
    try {
      await downloadInvoicePdf(items, selectedCompany ?? undefined, deliveryNoteRefs, id, items[0].invoiceReverseCharge)
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function downloadSelectedInvoices() {
    for (const group of selectedGroups) {
      const deliveryNoteRefs = [...new Set(group.items.map((r) => r.deliveryNoteId).filter(Boolean))].join(', ')
      await handleInvoiceDownload(group.id, group.items, deliveryNoteRefs)
    }
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    const deliveryNoteRefs = [...new Set(items.map((r) => r.deliveryNoteId).filter(Boolean))].join(', ')
    return (
      <>
        <DocLinkButton
          id={id}
          color="blue"
          onClick={() => void handleInvoiceDownload(id, items, deliveryNoteRefs)}
          loading={downloadingDocId === id}
        />
        {cancelId && (
          <DocLinkButton id={cancelId} color="red" onClick={() => void downloadStornoDoc(items, selectedCompany ?? undefined)} />
        )}
      </>
    )
  }

  if (!isLoggedIn) {
    return (
      <PageShell>
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Die Rechnungen sind nur nach Firmen-PIN verfügbar.</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline">
            Zum Login
          </Link>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <TopNav />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-title text-5xl text-slate-900">Rechnungen</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Rechnungen für {selectedCompany?.name}.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredCount} von {totalCountQuery.data ?? filteredCount} Rechnung{(totalCountQuery.data ?? filteredCount) !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              <option value="offen">Offen</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="storniert">Storniert</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechnungs-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        <SelectionActionBar
          count={selectedIds.size}
          noun="Rechnung"
          pluralLabel="Rechnungen"
          total={selectedTotal}
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              icon: <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2.25} />,
              onClick: exportSelectedAsCsv,
            },
            {
              label: 'Rechnung',
              icon: <Receipt className="h-3.5 w-3.5" strokeWidth={2.25} />,
              onClick: () => void downloadSelectedInvoices(),
            },
          ]}
        />

        {groupsQuery.isLoading ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Lädt…</p>
        ) : pageGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Rechnungen für die aktuellen Filter vorhanden.
          </p>
        ) : (
          <>
            <DocumentListTable
              groups={pageGroups}
              getBadge={invoiceBadge}
              getExtraBadges={reverseChargeExtraBadges}
              renderDateien={renderDateien}
              selectedIds={selectedIds}
              onSelectionChange={toggleSelection}
              areAllSelected={areAllVisibleSelected}
              onSelectAll={(checked) => (checked ? selectAllVisible(pageGroups) : deselectVisible(pageGroups))}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalCount={filteredCount} pageSize={pageSize} onPageSizeChange={setPageSize} />
          </>
        )}
      </section>
    </PageShell>
  )
}
