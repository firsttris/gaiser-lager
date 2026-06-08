import { jsPDF } from 'jspdf'
import { type RecordItem } from '../state/app-state'
import { flowLabel, money } from './history-utils'

export function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function truncatePdfText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

export function appendDeliveryNotePage(
  pdf: jsPDF,
  record: RecordItem,
  companyName: string,
  newPage: boolean,
) {
  if (newPage) {
    pdf.addPage()
  }

  const left = 15
  let y = 20

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Lieferschein', left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left, y)

  y += 6
  pdf.setFontSize(10)
  pdf.text(`Belegnummer: ${record.id}`, left, y)
  y += 5
  pdf.text(`Datum: ${record.createdAt}`, left, y)
  y += 5
  pdf.text(`Firma: ${companyName}`, left, y)
  y += 5
  pdf.text(`Vorgang: ${flowLabel(record.type)}`, left, y)

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('Position', left, y)
  y += 6
  pdf.setDrawColor(180)
  pdf.line(left, y, 195, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Material: ${record.productName}`, left, y)
  y += 6
  pdf.text(`Menge: ${record.amount} ${record.unit}`, left, y)
  y += 6
  pdf.text(`Einzelpreis: ${money(record.unitPrice)}`, left, y)
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Gesamt: ${money(record.total)}`, left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Status: ${record.status}`, left, y)
  y += 6
  const noteText = truncatePdfText(record.note || '-', 90)
  pdf.text(`Notiz: ${noteText}`, left, y)

  y += 14
  pdf.setDrawColor(180)
  pdf.line(left, y, 95, y)
  pdf.line(115, y, 195, y)
  y += 5
  pdf.setFontSize(9)
  pdf.text('Unterschrift Kunde', left, y)
  pdf.text('Unterschrift Gaiser', 115, y)
}

export function downloadDeliveryNote(record: RecordItem, companyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  appendDeliveryNotePage(pdf, record, companyName, false)

  const fileName = `lieferschein-${record.id}-${toSafeFileDate(record.createdAt)}.pdf`
  pdf.save(fileName)
}

export function downloadCombinedDeliveryNote(records: RecordItem[], companyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  let y = 20

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Lieferschein', left, y)

  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left, y)

  y += 6
  pdf.setFontSize(10)
  pdf.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, left, y)
  y += 5
  pdf.text(`Firma: ${companyName}`, left, y)
  y += 5
  pdf.text(`Positionen: ${records.length}`, left, y)

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('Positionen', left, y)
  y += 6
  pdf.setDrawColor(180)
  pdf.line(left, y, 195, y)

  y += 7
  let total = 0

  for (const [index, record] of records.entries()) {
    if (y > 260) {
      pdf.addPage()
      y = 20
    }

    total += record.total

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(`${index + 1}. ${record.productName}`, left, y)
    y += 5

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(
      `Belegnummer: ${record.id} | Vorgang: ${flowLabel(record.type)} | Zeit: ${record.createdAt}`,
      left,
      y,
    )
    y += 5
    pdf.text(
      `Menge: ${record.amount} ${record.unit} | Einzelpreis: ${money(record.unitPrice)} | Gesamt: ${money(record.total)}`,
      left,
      y,
    )
    y += 5
    const noteText = truncatePdfText(record.note || '-', 70)
    pdf.text(`Status: ${record.status} | Notiz: ${noteText}`, left, y)
    y += 6

    pdf.setDrawColor(220)
    pdf.line(left, y, 195, y)
    y += 5
  }

  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(`Gesamtsumme: ${money(total)}`, left, y)

  y += 16
  pdf.setDrawColor(180)
  pdf.line(left, y, 95, y)
  pdf.line(115, y, 195, y)
  y += 5
  pdf.setFontSize(9)
  pdf.text('Unterschrift Kunde', left, y)
  pdf.text('Unterschrift Gaiser', 115, y)

  const fileName = `lieferschein-sammel-${toSafeFileDate(new Date().toLocaleString('de-DE'))}.pdf`
  pdf.save(fileName)
}
