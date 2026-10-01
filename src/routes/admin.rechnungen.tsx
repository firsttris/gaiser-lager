import { createFileRoute, redirect } from '@tanstack/react-router'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, FileSpreadsheet, Receipt } from 'lucide-react'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { DocLinkButton } from '../components/doc-link-button'
import { DocumentListTable } from '../components/document-list-table'
import { Pagination } from '../components/pagination'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useGroupSelection } from '../hooks/use-group-selection'
import { type RecordItem, useAppState } from '../state/app-state'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { createHistoryCsv, downloadCsvFile, invoiceBadge, reverseChargeExtraBadges } from '../utils/history-utils'
import { countAllInvoiceGroups, listInvoiceGroupsPage } from '../server/invoices'
import { listRecordsByDocId } from '../server/records'
import { berlinIsoDate } from '../utils/berlin-time'

const DEFAULT_PAGE_SIZE = 25

export const Route = createFileRoute('/admin/rechnungen')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminRechnungenPage,
})

function AdminRechnungenPage() {
  const { companies, cancelRecords, markInvoicesPaid } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'offen' | 'bezahlt' | 'storniert'>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pendingAction, setPendingAction] = useState<{ action: () => Promise<void>; title: string; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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
  }, [companyId, statusFilter, debouncedSearch, dateFrom, dateTo, pageSize])

  const filters = {
    companyId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    dateFrom,
    dateTo,
  }

  const groupsQuery = useQuery({
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
    queryKey: ['invoice-groups', filters, page, pageSize] as const,
    queryFn: () => listInvoiceGroupsPage({ data: { ...filters, page, pageSize } }),
    placeholderData: keepPreviousData,
  })
  const totalCountQuery = useQuery({ queryKey: ['invoice-groups', 'count'] as const, queryFn: () => countAllInvoiceGroups() })

  const pageGroups = groupsQuery.data?.groups ?? []
  const filteredCount = groupsQuery.data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize))

  const { selectedIds, selectedGroups, selectedTotal, toggleSelection, selectAllVisible, deselectVisible, clearSelection } = useGroupSelection(pageGroups)

  const selectedAllOpen = useMemo(
    () => selectedGroups.length > 0 && selectedGroups.every((g) => invoiceBadge(g.items).label === 'Rechnung'),
    [selectedGroups],
  )

  function isSelectableGroup(items: RecordItem[]) {
    return invoiceBadge(items).label !== 'Storniert'
  }

  const selectablePageGroups = useMemo(() => pageGroups.filter((g) => isSelectableGroup(g.items)), [pageGroups])
  const areAllVisibleSelected = selectablePageGroups.length > 0 && selectablePageGroups.every((g) => selectedIds.has(g.id))

  // One cancellation per invoice, each its own transaction. The Storno PDF is
  // generated from the records as stored after the cancellation.
  async function stornoSelection() {
    const failures: string[] = []
    for (const group of selectedGroups) {
      const result = await cancelRecords(group.items.map((r) => r.id))
      if (!result.ok) {
        failures.push(`${group.id}: ${result.message}`)
        continue
      }
      const cancelled = await listRecordsByDocId({ data: { field: 'cancel_id', value: result.documentId } })
      if (cancelled.length) await downloadStornoDoc(cancelled, companyById(cancelled[0].companyId))
    }
    clearSelection()
    setActionError(failures.length ? `Nicht storniert: ${failures.join('; ')}` : null)
  }

  async function bezahltSelection() {
    const result = await markInvoicesPaid(selectedGroups.map((g) => g.id))
    if (!result.ok) {
      setActionError(result.message)
      return
    }
    setActionError(null)
    clearSelection()
  }

  function exportSelectedAsCsv() {
    if (selectedGroups.length === 0) return
    const csv = createHistoryCsv(selectedGroups.flatMap((g) => g.items), true)
    downloadCsvFile(`admin-rechnungen-${berlinIsoDate()}.csv`, csv)
  }

  async function downloadSelectedInvoices() {
    for (const group of selectedGroups) {
      const customer = companyById(group.items[0].companyId)
      const deliveryNoteIds = [...new Set(group.items.map((r) => r.deliveryNoteId).filter(Boolean))] as string[]
      await handleInvoiceDownload(group.id, group.items, customer, deliveryNoteIds.join(', '))
    }
  }

  async function handleInvoiceDownload(id: string, items: RecordItem[], customer: ReturnType<typeof companies.find>, deliveryNoteRefs: string) {
    setDownloadingDocId(id)
    try {
      await downloadInvoicePdf(items, customer, deliveryNoteRefs, id, items[0].invoiceReverseCharge)
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function handleDeliveryNoteDownload(deliveryNoteId: string, companyName: string, customer: ReturnType<typeof companies.find>) {
    setDownloadingDocId(deliveryNoteId)
    try {
      const group = await listRecordsByDocId({ data: { field: 'delivery_note_id', value: deliveryNoteId } })
      await downloadCombinedDeliveryNote(group, companyName, deliveryNoteId, customer)
    } finally {
      setDownloadingDocId(null)
    }
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    const customer = companyById(items[0].companyId)
    const deliveryNoteIds = [...new Set(items.map((r) => r.deliveryNoteId).filter(Boolean))] as string[]
    const deliveryNoteRefs = deliveryNoteIds.join(', ')
    return (
      <>
        <DocLinkButton
          id={id}
          color="blue"
          onClick={() => void handleInvoiceDownload(id, items, customer, deliveryNoteRefs)}
          loading={downloadingDocId === id}
        />
        {deliveryNoteIds.map((deliveryNoteId) => (
          <DocLinkButton
            key={deliveryNoteId}
            id={deliveryNoteId}
            color="amber"
            onClick={() => void handleDeliveryNoteDownload(deliveryNoteId, items[0].company, customer)}
            loading={downloadingDocId === deliveryNoteId}
          />
        ))}
        {cancelId && (
          <DocLinkButton id={cancelId} color="red" onClick={() => void downloadStornoDoc(items, customer)} />
        )}
      </>
    )
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Rechnungen</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Rechnungen über alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredCount} von {totalCountQuery.data ?? filteredCount} Rechnung{(totalCountQuery.data ?? filteredCount) !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Firma
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Firmen</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>

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
            {
              label: 'Stornieren',
              icon: <Ban className="h-3.5 w-3.5" strokeWidth={2.25} />,
              onClick: () => setPendingAction({
                action: stornoSelection,
                title: 'Rechnungen stornieren',
                message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Rechnung${selectedGroups.length !== 1 ? 'en' : ''} stornieren möchten?`,
              }),
            },
            {
              label: 'Als bezahlt markieren',
              icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />,
              variant: 'primary',
              disabled: !selectedAllOpen,
              onClick: () => setPendingAction({
                action: bezahltSelection,
                title: 'Als bezahlt markieren',
                message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Rechnung${selectedGroups.length !== 1 ? 'en' : ''} als bezahlt markieren möchten?`,
              }),
            },
          ]}
        />

        {actionError && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{actionError}</p>
        )}

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
              showCompanyColumn
              getBadge={invoiceBadge}
              getExtraBadges={reverseChargeExtraBadges}
              renderDateien={renderDateien}
              selectedIds={selectedIds}
              onSelectionChange={toggleSelection}
              isSelectable={isSelectableGroup}
              areAllSelected={areAllVisibleSelected}
              onSelectAll={(checked) => (checked ? selectAllVisible(selectablePageGroups) : deselectVisible(selectablePageGroups))}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalCount={filteredCount} pageSize={pageSize} onPageSizeChange={setPageSize} />
          </>
        )}
      </article>

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
