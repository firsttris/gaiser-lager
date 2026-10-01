import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, Upload, X } from 'lucide-react'
import { CompanySearchInput } from '../components/company-search-input'
import { Spinner } from '../components/spinner'
import { uploadDeliveryNotePhoto } from '../server/delivery-note-photos'
import { blobToDataUrl, captureVideoFrame, shrinkImageFile } from '../utils/shrink-image'

export const Route = createFileRoute('/mitarbeiter/lieferscheine')({ component: DeliveryNotePhotosPage })

type Photo = { id: string; blob: Blob; previewUrl: string }

// Drivers photograph the paper delivery notes they bring back (landfills
// etc.). Two ways: the live camera inside the page (kiosk tablet) or the
// device's camera app / gallery (phone). Photos land in the office inbox.
function DeliveryNotePhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [formKey, setFormKey] = useState(0)

  // Free the preview images when they're removed or the page closes.
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), [])

  function addPhoto(blob: Blob) {
    setMessage(null)
    setPhotos((current) => [...current, { id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) }])
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((entry) => entry.id === id)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return current.filter((entry) => entry.id !== id)
    })
  }

  async function addFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        addPhoto(await shrinkImageFile(file))
      } catch {
        setMessage({ kind: 'error', text: `${file.name} konnte nicht gelesen werden.` })
      }
    }
  }

  async function upload() {
    if (photos.length === 0) return
    setIsUploading(true)
    setMessage(null)
    const batchId = crypto.randomUUID()
    let uploaded = 0
    try {
      for (const photo of photos) {
        const result = await uploadDeliveryNotePhoto({
          data: {
            batchId,
            fileBase64: await blobToDataUrl(photo.blob),
            contentType: 'image/jpeg',
            companyId: companyId ?? undefined,
            note: note || undefined,
          },
        })
        if (!result.ok) throw new Error(result.message)
        uploaded++
        setProgress(uploaded)
      }
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
      setPhotos([])
      setNote('')
      setCompanyId(null)
      setFormKey((key) => key + 1)
      setMessage({ kind: 'success', text: `${uploaded} ${uploaded === 1 ? 'Foto wurde' : 'Fotos wurden'} ans Büro übertragen.` })
    } catch (error) {
      // Already uploaded photos stay in the office inbox; keep only the rest here.
      setPhotos((current) => current.slice(uploaded))
      setMessage({
        kind: 'error',
        text: `${uploaded} von ${photos.length} Fotos übertragen. ${error instanceof Error ? error.message : ''} Bitte die übrigen erneut senden.`,
      })
    } finally {
      setIsUploading(false)
      setProgress(0)
    }
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h2 className="font-title text-4xl text-slate-900">Lieferscheine fotografieren</h2>
        <p className="mt-1 text-slate-700">
          Mitgebrachte Lieferscheine (Deponie usw.) fotografieren und ans Büro senden. Mehrere Fotos auf einmal möglich.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-lg font-semibold text-white hover:bg-black"
          >
            <Camera className="h-6 w-6" strokeWidth={2.2} />
            Kamera öffnen
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-6 py-4 text-lg font-semibold text-slate-900 hover:bg-slate-200">
            <ImagePlus className="h-6 w-6" strokeWidth={2.2} />
            Foto auswählen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files)
                event.target.value = ''
              }}
            />
          </label>
        </div>

        {photos.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <figure key={photo.id} className="relative overflow-hidden rounded-xl border border-slate-200">
                <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  disabled={isUploading}
                  aria-label={`Foto ${index + 1} entfernen`}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-700 shadow hover:bg-white"
                >
                  <Trash2 className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </figure>
            ))}
          </div>
        )}
      </article>

      <article key={formKey} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="max-w-2xl">
          <CompanySearchInput onSelect={(company) => setCompanyId(company?.id ?? null)} />
          <p className="mt-1 text-sm text-slate-700">Optional: Für welchen Kunden war die Fahrt?</p>
        </div>
        <div className="max-w-2xl">
          <label className="text-sm font-semibold text-slate-700" htmlFor="photo-note">
            Notiz (optional)
          </label>
          <textarea
            id="photo-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="z.B. Deponie Bühl, 2 Fuhren Aushub"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
          />
        </div>

        {message && (
          <p className={`rounded-xl p-3 ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {message.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => void upload()}
          disabled={photos.length === 0 || isUploading}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-lg font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? <Spinner className="h-5 w-5" /> : <Upload className="h-6 w-6" strokeWidth={2.2} />}
          {isUploading
            ? `Wird gesendet … (${progress}/${photos.length})`
            : `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'} ans Büro senden`}
        </button>
      </article>

      {isCameraOpen && <LiveCamera onCapture={addPhoto} onClose={() => setIsCameraOpen(false)} count={photos.length} />}
    </section>
  )
}

// Full-screen live camera (kiosk tablet): hold the delivery note in front
// of the camera, tap "Foto aufnehmen", repeat, then "Fertig".
function LiveCamera({ onCapture, onClose, count }: { onCapture: (blob: Blob) => void; onClose: () => void; count: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((mediaStream) => {
        if (cancelled) return mediaStream.getTracks().forEach((track) => track.stop())
        stream = mediaStream
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      })
      .catch(() => setError('Kein Zugriff auf die Kamera. Bitte die Kamera-Freigabe erlauben oder „Foto auswählen“ nutzen.'))
    if (!navigator.mediaDevices) setError('Dieses Gerät unterstützt die Kamera im Browser nicht. Bitte „Foto auswählen“ nutzen.')
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function capture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    onCapture(await captureVideoFrame(video))
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {flash && <div className="absolute inset-0 bg-white/60" />}
        {error && <p className="absolute inset-x-4 top-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 bg-black p-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-6 py-4 text-lg font-semibold text-white"
        >
          <X className="h-6 w-6" /> Fertig ({count})
        </button>
        <button
          type="button"
          onClick={() => void capture()}
          disabled={Boolean(error)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          <Camera className="h-6 w-6" /> Foto aufnehmen
        </button>
      </div>
    </div>
  )
}
