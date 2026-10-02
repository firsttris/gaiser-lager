import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, X } from 'lucide-react'
import { captureVideoFrame, shrinkImageFile } from '../utils/shrink-image'

export type PendingPhoto = { id: string; blob: Blob; previewUrl: string }

export function createPendingPhoto(blob: Blob): PendingPhoto {
  return { id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) }
}

export function releasePendingPhotos(photos: PendingPhoto[]) {
  photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
}

// Photos of paper delivery notes, taken with the live camera inside the page
// (kiosk tablet) or the device's camera app / gallery (phone), shrunk on the
// device. The parent keeps the list and uploads it with the Vorgang.
export function DeliveryNotePhotoPicker({
  photos,
  onChange,
  disabled = false,
}: {
  photos: PendingPhoto[]
  onChange: (photos: PendingPhoto[]) => void
  disabled?: boolean
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [error, setError] = useState('')
  // The camera adds photos one by one; keep the latest list for its callback.
  const photosRef = useRef(photos)
  photosRef.current = photos

  function addPhoto(blob: Blob) {
    setError('')
    onChange([...photosRef.current, createPendingPhoto(blob)])
  }

  function removePhoto(id: string) {
    const photo = photos.find((entry) => entry.id === id)
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    onChange(photos.filter((entry) => entry.id !== id))
  }

  async function addFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        addPhoto(await shrinkImageFile(file))
      } catch {
        setError(`${file.name} konnte nicht gelesen werden.`)
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setIsCameraOpen(true)}
          disabled={disabled}
          className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Camera className="h-6 w-6" strokeWidth={2.2} />
          Kamera öffnen
        </button>
        <label
          className={`inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-6 py-4 text-lg font-semibold text-slate-900 hover:bg-slate-200 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ImagePlus className="h-6 w-6" strokeWidth={2.2} />
          Foto auswählen
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={disabled}
            className="hidden"
            onChange={(event) => {
              void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <figure key={photo.id} className="relative overflow-hidden rounded-xl border border-slate-200">
              <img src={photo.previewUrl} alt={`Lieferschein ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                disabled={disabled}
                aria-label={`Foto ${index + 1} entfernen`}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-3 text-red-700 shadow hover:bg-white"
              >
                <Trash2 className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </figure>
          ))}
        </div>
      )}

      {isCameraOpen && <LiveCamera onCapture={addPhoto} onClose={() => setIsCameraOpen(false)} count={photos.length} />}
    </div>
  )
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  const fallback = 'Alternativ „Foto auswählen“ nutzen.'
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Kamera-Zugriff wurde vom Browser blockiert. Bitte die Kamera-Freigabe für diese Seite und die Browser-App erlauben. ${fallback} (${name})`
    case 'NotReadableError':
    case 'AbortError':
      return `Die Kamera wird gerade von einer anderen App oder Funktion benutzt (z. B. Bewegungserkennung im Kiosk-Browser). ${fallback} (${name})`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Es wurde keine passende Kamera gefunden. ${fallback} (${name})`
    default:
      return `Kein Zugriff auf die Kamera. Bitte die Kamera-Freigabe erlauben. ${fallback}${name ? ` (${name})` : ''}`
  }
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
    const mediaDevices = navigator.mediaDevices
    mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      // Older Android WebViews (kiosk browsers) sometimes reject the detailed
      // constraints – retry with the plainest possible request.
      .catch((error) => (error?.name === 'NotAllowedError' ? Promise.reject(error) : mediaDevices.getUserMedia({ video: true, audio: false })))
      .then((mediaStream) => {
        if (cancelled) return mediaStream.getTracks().forEach((track) => track.stop())
        stream = mediaStream
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      })
      .catch((error) => setError(cameraErrorMessage(error)))
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
