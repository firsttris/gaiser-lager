import { jsPDF } from 'jspdf'
import type { RecordItem } from '../state/app-state'
import { quantity } from './history-utils'

const PAGE = { width: 210, height: 297 }
const MARGIN = 12
const HEADER_HEIGHT = 16

export function photoPdfFileName(record: Pick<RecordItem, 'id' | 'deliveryNoteId'>) {
  return `${record.deliveryNoteId ?? `Vorgang-${record.id}`}-Fotos.pdf`
}

// Largest size that keeps the photo's aspect ratio inside the box, centred.
export function fitIntoBox(image: { width: number; height: number }, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(box.width / image.width, box.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height }
}

// jsPDF can't embed WebP, and drivers' photos may be either; re-encoding
// through a canvas gives a JPEG with known pixel size for every source.
async function loadAsJpeg(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Ein Foto konnte nicht geladen werden.')
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height }
}

// All delivery note photos of one Vorgang as one PDF for filing: one photo
// per page, the Vorgang on top of each page.
export async function downloadRecordPhotosPdf(record: RecordItem, urls: string[]) {
  if (!urls.length) throw new Error('Zu diesem Vorgang gibt es keine Fotos.')
  const images = await Promise.all(urls.map(loadAsJpeg))

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const title = `Lieferschein-Fotos · Vorgang ${record.deliveryNoteId ?? record.id}`
  const details = [
    record.company,
    `${record.productName}, ${quantity(record.amount)} ${record.unit}`,
    `Baustelle ${record.constructionSiteName || '—'}`,
    record.createdByName ? `Fahrer ${record.createdByName}` : null,
    record.createdAt,
  ]
    .filter(Boolean)
    .join(' · ')

  images.forEach((image, index) => {
    if (index > 0) pdf.addPage()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(title, MARGIN, MARGIN + 2)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.text(pdf.splitTextToSize(details, PAGE.width - 2 * MARGIN)[0], MARGIN, MARGIN + 7)
    pdf.text(`Foto ${index + 1} / ${images.length}`, PAGE.width - MARGIN, MARGIN + 2, { align: 'right' })

    const box = { x: MARGIN, y: MARGIN + HEADER_HEIGHT, width: PAGE.width - 2 * MARGIN, height: PAGE.height - 2 * MARGIN - HEADER_HEIGHT }
    const placed = fitIntoBox(image, box)
    pdf.addImage(image.dataUrl, 'JPEG', placed.x, placed.y, placed.width, placed.height)
  })

  pdf.save(photoPdfFileName(record))
}
