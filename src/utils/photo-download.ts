import type { RecordItem } from '../state/app-state'

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }

export function photoFileName(record: Pick<RecordItem, 'id' | 'deliveryNoteId'>, index: number, contentType: string) {
  const base = record.deliveryNoteId ?? `Vorgang-${record.id}`
  return `${base}-Foto-${index + 1}.${EXTENSIONS[contentType.split(';')[0].trim()] ?? 'jpg'}`
}

// The photos sit behind signed Storage URLs on another origin, where the
// browser ignores <a download>; fetching the file first makes it a real
// download with a useful name instead of opening a tab.
export async function downloadPhoto(url: string, fileName: (contentType: string) => string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Das Foto konnte nicht heruntergeladen werden.')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName(blob.type)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}
