// Delivery note photos are shrunk on the device before upload: phone/tablet
// cameras produce 3–8 MB per photo; 2000 px on the long side as JPEG is
// ~0.3–0.5 MB and still easily readable. Saves upload time and storage.
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.82

function drawScaled(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Foto konnte nicht verarbeitet werden.'))), 'image/jpeg', JPEG_QUALITY),
  )
}

/** A photo file (camera app / gallery); EXIF rotation is applied. */
export async function shrinkImageFile(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    return await drawScaled(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

/** The current frame of a live camera preview. */
export function captureVideoFrame(video: HTMLVideoElement) {
  return drawScaled(video, video.videoWidth, video.videoHeight)
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
