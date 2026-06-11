import { jsPDF } from 'jspdf'
import { type RecordItem } from '../state/app-state'
import { flowLabel, money } from './history-utils'

export function downloadInvoicePdf(
  invoiceRecords: RecordItem[],
  companyShortCode: string | undefined,
  deliveryNoteId?: string,
  existingInvoiceNo?: string,
): string {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 12
  const right = 198
  let y = 16

  const invoiceNo = existingInvoiceNo ?? `RG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${invoiceRecords[0].id}`
  const customerName = invoiceRecords[0].company

  pdf.setDrawColor(220)
  pdf.setFillColor(248, 250, 252)
  pdf.roundedRect(left, y, 186, 26, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text('RECHNUNG', left + 4, y + 9)
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left + 4, y + 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Musterstrasse 1, 10115 Berlin', left + 4, y + 21)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(`Nr.: ${invoiceNo}`, right - 4, y + 10, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, right - 4, y + 16, { align: 'right' })
  pdf.text(`Positionen: ${invoiceRecords.length}`, right - 4, y + 21, { align: 'right' })

  y += 36

  pdf.setDrawColor(225)
  pdf.roundedRect(left, y, 120, 24, 2, 2)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('Rechnungsadresse', left + 3, y + 6)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(customerName, left + 3, y + 11)
  if (companyShortCode) {
    pdf.text(`Kuerzel: ${companyShortCode}`, left + 3, y + 16)
  }
  pdf.text('z. Hd. Buchhaltung', left + 3, y + 21)

  y += 40

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (deliveryNoteId) {
    pdf.text(`Bezug: Lieferschein-Nr. ${deliveryNoteId}`, left, y)
    y += 5
  }
  pdf.text(
    `Leistungszeitraum: ${invoiceRecords[0].createdAt} bis ${invoiceRecords[invoiceRecords.length - 1].createdAt}`,
    left,
    y,
  )

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.setFillColor(241, 245, 249)
  pdf.rect(left, y - 4.5, 186, 7.5, 'F')
  pdf.text('Pos.', left, y)
  pdf.text('Datum', 24, y)
  pdf.text('Leistung', 56, y)
  pdf.text('Menge', 132, y)
  pdf.text('EP', 158, y)
  pdf.text('Betrag', right, y, { align: 'right' })

  y += 3
  pdf.setDrawColor(190)
  pdf.line(left, y, right, y)
  y += 7

  let subtotal = 0

  for (const [index, record] of invoiceRecords.entries()) {
    subtotal += record.total

    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    const createdAt = record.createdAt.slice(0, 10)
    const service = `${flowLabel(record.type)}: ${record.productName} (${record.constructionSiteName || '-'})`
    const serviceShort = service.length > 40 ? `${service.slice(0, 37)}...` : service

    pdf.text(String(index + 1), left, y)
    pdf.text(createdAt, 24, y)
    pdf.text(serviceShort, 56, y)
    pdf.text(`${record.amount} ${record.unit}`, 132, y)
    pdf.text(money(record.unitPrice), 158, y)
    pdf.text(money(record.total), right, y, { align: 'right' })

    y += 4
    pdf.setDrawColor(235)
    pdf.line(left, y, right, y)
    y += 6
  }

  if (y > 210) {
    pdf.addPage()
  }

  const vat = subtotal * 0.19
  const gross = subtotal + vat
  const summaryBoxWidth = 72
  const summaryBoxX = 126
  const summaryTop = 236

  pdf.setDrawColor(220)
  pdf.roundedRect(summaryBoxX, summaryTop, summaryBoxWidth, 24, 2, 2)
  y = summaryTop + 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Zwischensumme (netto):', summaryBoxX + 3, y)
  pdf.text(money(subtotal), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 5
  pdf.text('zzgl. 19% USt.:', summaryBoxX + 3, y)
  pdf.text(money(vat), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Rechnungsbetrag:', summaryBoxX + 3, y)
  pdf.text(money(gross), summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })

  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Zahlbar ohne Abzug innerhalb von 14 Tagen.', left, y)
  y += 5
  pdf.text('Vielen Dank fuer Ihren Auftrag.', left, y)

  pdf.save(`rechnung-${toSafeFileDate(invoiceNo)}.pdf`)

  return invoiceNo
}

export function downloadStornoDoc(
  records: RecordItem[],
  companyName: string,
  cancelId: string,
  originalDocId?: string,
) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 12
  const right = 198
  let y = 16

  pdf.setDrawColor(220)
  pdf.setFillColor(254, 242, 242)
  pdf.roundedRect(left, y, 186, 26, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text('STORNORECHNUNG', left + 4, y + 9)
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left + 4, y + 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Musterstrasse 1, 10115 Berlin', left + 4, y + 21)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(`Nr.: ${cancelId}`, right - 4, y + 10, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, right - 4, y + 16, { align: 'right' })
  pdf.text(`Positionen: ${records.length}`, right - 4, y + 21, { align: 'right' })

  y += 36

  pdf.setDrawColor(225)
  pdf.roundedRect(left, y, 120, 24, 2, 2)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('Rechnungsadresse', left + 3, y + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(companyName, left + 3, y + 11)
  pdf.text('z. Hd. Buchhaltung', left + 3, y + 21)

  y += 40

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (originalDocId) {
    pdf.text(`Storno zu: ${originalDocId}`, left, y)
    y += 5
  }
  pdf.text(
    `Leistungszeitraum: ${records[0].createdAt} bis ${records[records.length - 1].createdAt}`,
    left,
    y,
  )

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.setFillColor(254, 226, 226)
  pdf.rect(left, y - 4.5, 186, 7.5, 'F')
  pdf.text('Pos.', left, y)
  pdf.text('Datum', 24, y)
  pdf.text('Leistung', 56, y)
  pdf.text('Menge', 132, y)
  pdf.text('EP', 158, y)
  pdf.text('Betrag', right, y, { align: 'right' })

  y += 3
  pdf.setDrawColor(190)
  pdf.line(left, y, right, y)
  y += 7

  let subtotal = 0

  for (const [index, record] of records.entries()) {
    subtotal += record.total

    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    const createdAt = record.createdAt.slice(0, 10)
    const service = `${flowLabel(record.type)}: ${record.productName} (${record.constructionSiteName || '-'})`
    const serviceShort = service.length > 40 ? `${service.slice(0, 37)}...` : service

    pdf.text(String(index + 1), left, y)
    pdf.text(createdAt, 24, y)
    pdf.text(serviceShort, 56, y)
    pdf.text(`${record.amount} ${record.unit}`, 132, y)
    pdf.text(money(record.unitPrice), 158, y)
    pdf.text(`-${money(record.total)}`, right, y, { align: 'right' })

    y += 4
    pdf.setDrawColor(235)
    pdf.line(left, y, right, y)
    y += 6
  }

  const vat = subtotal * 0.19
  const gross = subtotal + vat
  const summaryBoxWidth = 72
  const summaryBoxX = 126
  const summaryTop = 236

  pdf.setDrawColor(220)
  pdf.roundedRect(summaryBoxX, summaryTop, summaryBoxWidth, 24, 2, 2)
  y = summaryTop + 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Zwischensumme (netto):', summaryBoxX + 3, y)
  pdf.text(`-${money(subtotal)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 5
  pdf.text('zzgl. 19% USt.:', summaryBoxX + 3, y)
  pdf.text(`-${money(vat)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Gutschriftsbetrag:', summaryBoxX + 3, y)
  pdf.text(`-${money(gross)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })

  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Diese Gutschrift storniert den oben genannten Beleg vollstaendig.', left, y)

  pdf.save(`storno-${toSafeFileDate(cancelId)}.pdf`)
}

export function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
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
  pdf.text(`Baustelle: ${record.constructionSiteName || '-'}`, left, y)
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

  const pageHeight = 297
  const sigLineY = pageHeight - 22
  const sigLabelY = pageHeight - 17

  pdf.setDrawColor(180)
  pdf.line(left, sigLineY, 95, sigLineY)
  pdf.line(115, sigLineY, 195, sigLineY)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Ort, Datum', 55, sigLabelY, { align: 'center' })
  pdf.text('Ware geprüft und erhalten', 155, sigLabelY, { align: 'center' })
}

export function downloadDeliveryNote(record: RecordItem, companyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  appendDeliveryNotePage(pdf, record, companyName, false)

  const fileName = `lieferschein-${record.id}-${toSafeFileDate(record.createdAt)}.pdf`
  pdf.save(fileName)
}

export function downloadCombinedDeliveryNote(records: RecordItem[], companyName: string, deliveryNoteId?: string) {
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
  if (deliveryNoteId) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Lieferschein-Nr.: ${deliveryNoteId}`, left, y)
    pdf.setFont('helvetica', 'normal')
    y += 5
  }
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
    pdf.text(`Baustelle: ${record.constructionSiteName || '-'}`, left, y)
    y += 5
    pdf.text(
      `Menge: ${record.amount} ${record.unit} | Einzelpreis: ${money(record.unitPrice)} | Gesamt: ${money(record.total)}`,
      left,
      y,
    )
    y += 5
    pdf.text(`Status: ${record.status}`, left, y)
    y += 6

    pdf.setDrawColor(220)
    pdf.line(left, y, 195, y)
    y += 5
  }

  const pageHeight = 297
  const sigLineY = pageHeight - 22
  const sigLabelY = pageHeight - 17

  const totalY = sigLineY - 18

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Gesamtsumme: ${money(total)}`, left, totalY)

  pdf.setDrawColor(180)
  pdf.line(left, sigLineY, 95, sigLineY)
  pdf.line(115, sigLineY, 195, sigLineY)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Ort, Datum', 55, sigLabelY, { align: 'center' })
  pdf.text('Ware geprüft und erhalten', 155, sigLabelY, { align: 'center' })

  const fileName = deliveryNoteId
    ? `lieferschein-${toSafeFileDate(deliveryNoteId)}.pdf`
    : `lieferschein-sammel-${toSafeFileDate(new Date().toLocaleString('de-DE'))}.pdf`
  pdf.save(fileName)
}
