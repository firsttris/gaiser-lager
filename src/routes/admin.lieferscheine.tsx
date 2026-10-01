import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { adminSetDeliveryNoteBatchProcessed, deliveryNotePhotosQueryOptions } from '../server/delivery-note-photos'
import { DateRangeFilter, type DateRangeState, initialDateRange, resolveDateRange } from '../components/date-range-filter'
import { formatBerlinDateTime } from '../utils/berlin-time'
import { LIST_REFETCH_INTERVAL_MS } from '../utils/refresh'

export const Route = createFileRoute('/admin/lieferscheine')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminDeliveryNoteInboxPage,
})

// Inbox for the photos drivers take of paper delivery notes (landfills etc.).
function AdminDeliveryNoteInboxPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateRange)
  const filters = { status, dateFrom, dateTo }
  const batchesQuery = useQuery({ ...deliveryNotePhotosQueryOptions(filters), refetchInterval: LIST_REFETCH_INTERVAL_MS })
  const batches = batchesQuery.data ?? []
  const setProcessed = useMutation({
    mutationFn: adminSetDeliveryNoteBatchProcessed,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['delivery-note-photos'] }),
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Lieferschein-Eingang</h2>
      <p className="mt-1 text-sm text-slate-700">
        Von den Fahrern fotografierte Lieferscheine (Deponie usw.). Foto antippen zum Vergrößern bzw. Herunterladen.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
          >
            <option value="open">Offen</option>
            <option value="done">Erledigt</option>
            <option value="all">Alle</option>
          </select>
        </label>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {batchesQuery.isLoading ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">Lädt…</p>
      ) : batches.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">Keine Lieferscheine für diese Auswahl.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {batches.map((batch) => (
            <article
              key={batch.batchId}
              className={`rounded-xl border border-slate-200 p-4 ${batch.processedAt ? 'bg-slate-50' : 'bg-white'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {batch.employeeName} · {formatBerlinDateTime(batch.createdAt)}
                  </p>
                  <p className="text-sm text-slate-700">
                    {batch.photos.length} {batch.photos.length === 1 ? 'Foto' : 'Fotos'}
                    {batch.companyName && <> · Kunde: {batch.companyName}</>}
                  </p>
                  {batch.note && <p className="mt-1 text-sm text-slate-800">„{batch.note}“</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setProcessed.mutate({ data: { batchId: batch.batchId, processed: !batch.processedAt } })}
                  disabled={setProcessed.isPending}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    batch.processedAt ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {batch.processedAt ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {batch.processedAt ? 'Wieder öffnen' : 'Erledigt'}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {batch.photos.map((photo, index) =>
                  photo.url ? (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                      <img src={photo.url} alt={`Lieferschein ${index + 1}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                    </a>
                  ) : (
                    <div key={photo.id} className="flex aspect-[3/4] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-700">
                      nicht verfügbar
                    </div>
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
