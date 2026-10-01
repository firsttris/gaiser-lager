import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { HistoryTable } from '../components/history-table'
import { Pagination } from '../components/pagination'
import { listRecordsByDocId, listRecordsPage } from '../server/records'
import { getCompanyForBooking } from '../server/companies'
import { downloadCombinedDeliveryNote } from '../utils/delivery-note-utils'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'

export const Route = createFileRoute('/mitarbeiter/buchungen')({ component: EmployeeBookingsPage })

const PAGE_SIZE = 25
const noSelection = new Set<number>()

// What this driver booked (the server only returns their own records), with
// the delivery note to download again.
function EmployeeBookingsPage() {
  const [page, setPage] = useState(1)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const recordsQuery = useQuery({
    queryKey: ['records', 'employee', page] as const,
    queryFn: () => listRecordsPage({ data: { page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  })
  const records = recordsQuery.data?.records ?? []
  const totalCount = recordsQuery.data?.totalCount ?? 0

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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Meine Buchungen</h2>
      <p className="mt-1 text-slate-700">Alle Vorgänge, die du gebucht hast. Lieferschein antippen zum Herunterladen.</p>

      {recordsQuery.isLoading ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">Lädt…</p>
      ) : records.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">Noch keine Buchungen.</p>
      ) : (
        <>
          <HistoryTable
            records={records}
            selectable={false}
            selectedSet={noSelection}
            areAllVisibleSelected={false}
            onSelectAll={() => undefined}
            onToggle={() => undefined}
            showCompanyColumn
            onDeliveryNoteClick={(id) => void downloadDeliveryNote(id)}
            downloadingDocId={downloadingDocId}
          />
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
            onPageChange={setPage}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageSizeChange={() => undefined}
          />
        </>
      )}
    </section>
  )
}
