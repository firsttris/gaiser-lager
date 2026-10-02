import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import type { RecordItem } from '../state/app-state'
import { listRecordPhotos } from '../server/delivery-note-photos'
import { quantity } from '../utils/history-utils'

// The delivery note photos a driver attached to an LKW Vorgang, opened from
// the "Fotos" button in the Dateien column.
export function RecordPhotosDialog({ record, onClose }: { record: RecordItem | null; onClose: () => void }) {
  const photosQuery = useQuery({
    queryKey: ['record-photos', record?.id] as const,
    queryFn: () => listRecordPhotos({ data: { recordId: record!.id } }),
    enabled: record !== null,
    // Signed URLs are valid for an hour; refetch rather than show dead links.
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (!record) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [record, onClose])

  if (!record) return null
  const photos = photosQuery.data ?? []

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lieferschein-Fotos"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex flex-wrap items-start justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white p-5">
          <div className="min-w-0 flex-1">
            <h3 className="font-title text-2xl text-slate-900">Lieferschein-Fotos</h3>
            <p className="mt-1 text-sm text-slate-700">
              Vorgang <span className="font-mono font-semibold">{record.deliveryNoteId ?? '—'}</span> · {record.company} ·{' '}
              {record.productName}, {quantity(record.amount)} {record.unit} · Baustelle {record.constructionSiteName || '—'}
              {record.createdByName && <> · Fahrer {record.createdByName}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Schließen
          </button>
        </div>
        <div className="p-5">
          {photosQuery.isLoading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-700">Lädt…</p>
          ) : photos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-700">Zu diesem Vorgang gibt es keine Fotos.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">Foto antippen zum Vergrößern bzw. Herunterladen.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo, index) =>
                  photo.url ? (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-slate-200"
                    >
                      <img src={photo.url} alt={`Lieferschein-Foto ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                    </a>
                  ) : (
                    <div key={photo.id} className="flex aspect-[3/4] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-700">
                      nicht verfügbar
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
