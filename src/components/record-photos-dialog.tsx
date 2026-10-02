import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, FileDown, LayoutGrid } from 'lucide-react'
import type { RecordItem } from '../state/app-state'
import { listRecordPhotos } from '../server/delivery-note-photos'
import { quantity } from '../utils/history-utils'
import { downloadPhoto, photoFileName } from '../utils/photo-download'
import { downloadRecordPhotosPdf } from '../utils/photo-pdf'
import { Spinner } from './spinner'

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60'

// The delivery note photos a driver attached to an LKW Vorgang, opened from
// the "Fotos" entry in the Dateien column: a gallery to check them, a large
// view per photo, and downloads (each photo, or all as one PDF for filing).
export function RecordPhotosDialog({ record, onClose }: { record: RecordItem | null; onClose: () => void }) {
  const photosQuery = useQuery({
    queryKey: ['record-photos', record?.id] as const,
    queryFn: () => listRecordPhotos({ data: { recordId: record!.id } }),
    enabled: record !== null,
    // Signed URLs are valid for an hour; refetch rather than show dead links.
    staleTime: 10 * 60 * 1000,
  })
  const photos = photosQuery.data ?? []
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  // 'pdf' or the photo index currently downloading.
  const [downloading, setDownloading] = useState<'pdf' | number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setViewIndex(null)
    setError(null)
  }, [record?.id])

  const step = (delta: number) =>
    setViewIndex((index) => (index === null || photos.length === 0 ? index : (index + delta + photos.length) % photos.length))

  useEffect(() => {
    if (!record) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (viewIndex !== null) setViewIndex(null)
        else onClose()
      } else if (viewIndex !== null && event.key === 'ArrowRight') step(1)
      else if (viewIndex !== null && event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!record) return null

  async function run(kind: 'pdf' | number, action: () => Promise<void>) {
    setDownloading(kind)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Der Download ist fehlgeschlagen.')
    } finally {
      setDownloading(null)
    }
  }

  const downloadOne = (index: number) => {
    const url = photos[index]?.url
    if (!url || !record) return
    void run(index, () => downloadPhoto(url, (contentType) => photoFileName(record, index, contentType)))
  }
  const availableUrls = photos.map((photo) => photo.url).filter((url): url is string => Boolean(url))
  const downloadAll = () => void run('pdf', () => downloadRecordPhotosPdf(record, availableUrls))

  const viewed = viewIndex !== null ? photos[viewIndex] : null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lieferschein-Fotos"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white p-5">
          <div className="min-w-0 flex-1">
            <h3 className="font-title text-2xl text-slate-900">Lieferschein-Fotos</h3>
            <p className="mt-1 text-sm text-slate-700">
              Vorgang <span className="font-mono font-semibold">{record.deliveryNoteId ?? '—'}</span> · {record.company} ·{' '}
              {record.productName}, {quantity(record.amount)} {record.unit} · Baustelle {record.constructionSiteName || '—'}
              {record.createdByName && <> · Fahrer {record.createdByName}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableUrls.length > 0 && (
              <button type="button" onClick={downloadAll} disabled={downloading !== null} className={secondaryButton}>
                {downloading === 'pdf' ? <Spinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" strokeWidth={2.25} />}
                Alle als PDF
              </button>
            )}
            <button type="button" onClick={onClose} className={secondaryButton}>
              Schließen
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {photosQuery.isLoading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-700">Lädt…</p>
          ) : photos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-700">Zu diesem Vorgang gibt es keine Fotos.</p>
          ) : viewed && viewIndex !== null ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setViewIndex(null)} className={secondaryButton}>
                  <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
                  Alle Fotos
                </button>
                <p className="text-sm font-semibold text-slate-700">
                  Foto {viewIndex + 1} von {photos.length}
                </p>
                <button
                  type="button"
                  onClick={() => downloadOne(viewIndex)}
                  disabled={!viewed.url || downloading !== null}
                  className={secondaryButton}
                >
                  {downloading === viewIndex ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" strokeWidth={2.25} />}
                  Herunterladen
                </button>
              </div>
              <div className="relative flex items-center justify-center rounded-xl bg-slate-900">
                {viewed.url ? (
                  <img
                    src={viewed.url}
                    alt={`Lieferschein-Foto ${viewIndex + 1}`}
                    className="max-h-[70vh] w-auto max-w-full object-contain"
                  />
                ) : (
                  <p className="p-10 text-sm text-slate-200">Foto nicht verfügbar</p>
                )}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      aria-label="Vorheriges Foto"
                      className="absolute top-1/2 left-2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
                    >
                      <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      aria-label="Nächstes Foto"
                      className="absolute top-1/2 right-2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
                    >
                      <ChevronRight className="h-7 w-7" strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">Foto antippen zum Vergrößern.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200">
                    {photo.url ? (
                      <button type="button" onClick={() => setViewIndex(index)} className="block w-full" aria-label={`Foto ${index + 1} vergrößern`}>
                        <img src={photo.url} alt={`Lieferschein-Foto ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                      </button>
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center bg-slate-100 text-sm text-slate-700">nicht verfügbar</div>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadOne(index)}
                      disabled={!photo.url || downloading !== null}
                      className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloading === index ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" strokeWidth={2.25} />}
                      Herunterladen
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
