import { GState, jsPDF } from 'jspdf'
import { type RecordItem } from '../state/app-state'
import { flowLabel, money } from './history-utils'
import { formatBerlinDate } from './berlin-time'
import { roundCents, VAT_RATE } from './money'
import { isDevelopmentDatabase } from './environment'

const LOGO_URL = `${import.meta.env.BASE_URL}assets/Logo.jpeg`
const LOGO_ASPECT_RATIO = 303 / 873

// Invoices are rendered on the server with an embedded font (PDF/A-3 for
// ZUGFeRD forbids non-embedded fonts); every other document keeps jsPDF's
// built-in Helvetica. Liberation Sans has the same metrics, so the layout is
// identical either way.
export const EMBEDDED_FONT_FAMILY = 'LiberationSans'

function setFont(pdf: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic') {
  const family = EMBEDDED_FONT_FAMILY in pdf.getFontList() ? EMBEDDED_FONT_FAMILY : 'helvetica'
  pdf.setFont(family, style)
}

export const COMPANY_INFO = {
  name: 'Gaiser GmbH Erdbau und Abbruch',
  street: 'Hansjakobweg 14',
  city: '77830 Bühlertal',
  phone: '+49 170 2416906',
  email: 'info@gaiser-abbruch.de',
  taxOffice: 'Finanzamt Baden-Baden',
  vatId: 'DE338636212',
  banks: [
    { name: 'Sparkasse Bühl', bic: 'SOLADES1BHL', iban: 'DE44 6625 1434 0000 5249 91' },
    { name: 'Volksbank Bühl', bic: 'GENODE61BHL', iban: 'DE96 6629 1400 0005 2942 23' },
  ],
  management: 'Geschäftsführer: Rolf Gaiser, Marius Schmidt | Reg.-Nr. HRB 738556 | Amtsgericht Mannheim',
}

let logoDataUrlPromise: Promise<string> | null = null

function loadLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_URL)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          }),
      )
  }
  return logoDataUrlPromise
}

function formatQty(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

export type InvoiceLineItem = {
  type: RecordItem['type']
  productName: string
  unit: string
  unitPrice: number
  amount: number
  total: number
}

function aggregateInvoiceLineItems(invoiceRecords: RecordItem[]): InvoiceLineItem[] {
  const byKey = new Map<string, InvoiceLineItem>()
  const orderedItems: InvoiceLineItem[] = []

  for (const record of invoiceRecords) {
    const key = [record.type, record.productName, record.unit, record.unitPrice].join('::')
    const existing = byKey.get(key)

    if (existing) {
      existing.amount += record.amount
      existing.total += record.total
      continue
    }

    const item: InvoiceLineItem = {
      type: record.type,
      productName: record.productName,
      unit: record.unit,
      unitPrice: record.unitPrice,
      amount: record.amount,
      total: record.total,
    }
    byKey.set(key, item)
    orderedItems.push(item)
  }

  return orderedItems
}

function drawLetterhead(pdf: jsPDF, left: number, right: number, logoDataUrl: string) {
  const logoWidth = 50
  const logoHeight = logoWidth * LOGO_ASPECT_RATIO
  const logoCenterX = right - logoWidth / 2
  pdf.addImage(logoDataUrl, 'JPEG', right - logoWidth, 12, logoWidth, logoHeight)

  let y = 12 + logoHeight + 4
  setFont(pdf, 'bold')
  pdf.setFontSize(9)
  pdf.text(COMPANY_INFO.street, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(COMPANY_INFO.city, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(`Tel: ${COMPANY_INFO.phone}`, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(COMPANY_INFO.email, logoCenterX, y, { align: 'center' })
  const addressBottom = y

  y = 38
  setFont(pdf, 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(120)
  pdf.text(`${COMPANY_INFO.name} | ${COMPANY_INFO.street} | ${COMPANY_INFO.city}`, left, y)
  pdf.setTextColor(0)

  return addressBottom
}

function drawCompanyFooter(pdf: jsPDF) {
  const left = 15
  const right = 195
  const col2 = left + 60
  const col3 = left + 110
  const y = 266

  pdf.setDrawColor(200)
  pdf.line(left, y, right, y)

  let fy = y + 5
  setFont(pdf, 'bold')
  pdf.setFontSize(7.5)
  pdf.text(COMPANY_INFO.name, left, fy)
  pdf.text(COMPANY_INFO.taxOffice, col2, fy)
  pdf.text('Bankverbindungen:', col3, fy)

  fy += 4
  setFont(pdf, 'normal')
  pdf.text(COMPANY_INFO.street, left, fy)
  pdf.text(`Umsatzsteuer-ID: ${COMPANY_INFO.vatId}`, col2, fy)
  setFont(pdf, 'bold')
  pdf.text(COMPANY_INFO.banks[0].name, col3, fy)

  fy += 4
  setFont(pdf, 'normal')
  pdf.text(COMPANY_INFO.city, left, fy)
  pdf.text(`SWIFT-BIC: ${COMPANY_INFO.banks[0].bic} | IBAN: ${COMPANY_INFO.banks[0].iban}`, col3, fy)

  fy += 4
  pdf.text(`Tel: ${COMPANY_INFO.phone}`, left, fy)
  setFont(pdf, 'bold')
  pdf.text(`${COMPANY_INFO.banks[1].name}:`, col3, fy)

  fy += 4
  setFont(pdf, 'normal')
  pdf.text(COMPANY_INFO.email, left, fy)
  pdf.text(`SWIFT-BIC: ${COMPANY_INFO.banks[1].bic} | IBAN: ${COMPANY_INFO.banks[1].iban}`, col3, fy)

  fy += 5
  pdf.setFontSize(7)
  pdf.setTextColor(100)
  pdf.text(COMPANY_INFO.management, (left + right) / 2, fy, { align: 'center' })
  pdf.setTextColor(0)
}

export type InvoiceCustomer = {
  customerNumber?: string
  street?: string
  postalCode?: string
  city?: string
}

// Documents are dated with the day they were issued (stored in the database),
// not the day the PDF happens to be downloaded. Legacy documents without a
// stored date fall back to today, as before.
function documentDate(issuedAt: string | undefined) {
  return formatBerlinDate(issuedAt ?? new Date())
}

function servicePeriod(records: RecordItem[]) {
  const times = records.map((r) => new Date(r.createdAtIso).getTime())
  const first = formatBerlinDate(new Date(Math.min(...times)))
  const last = formatBerlinDate(new Date(Math.max(...times)))
  return first === last ? first : `${first} - ${last}`
}

function latestRecordDate(records: RecordItem[]) {
  return formatBerlinDate(new Date(Math.max(...records.map((r) => new Date(r.createdAtIso).getTime()))))
}

// Recipient address block (left) + document meta rows (right), shared by
// invoices and cancellations. Returns where the body can start and where the
// "Seite" value sits so it can be rewritten once the page count is known.
function drawRecipientAndMeta(
  pdf: jsPDF,
  left: number,
  right: number,
  logoDataUrl: string,
  customerName: string,
  customer: InvoiceCustomer | undefined,
  metaRows: Array<[string, string]>,
) {
  const addressBottom = drawLetterhead(pdf, left, right, logoDataUrl)

  let y = 38 + 7
  setFont(pdf, 'normal')
  pdf.setFontSize(11)
  pdf.text(customerName, left, y)

  if (customer?.street) {
    y += 5
    pdf.text(customer.street, left, y)
  }

  const customerPostalCodeAndCity = [customer?.postalCode, customer?.city].filter(Boolean).join(' ')
  if (customerPostalCodeAndCity) {
    y += 5
    pdf.text(customerPostalCodeAndCity, left, y)
  }

  const metaLabelX = 122
  setFont(pdf, 'bold')
  pdf.setFontSize(9)
  const metaValueX = metaLabelX + Math.max(...metaRows.map(([label]) => pdf.getTextWidth(label))) + 3

  let metaY = addressBottom + 8
  let seiteY = metaY
  for (const [label, value] of metaRows) {
    setFont(pdf, 'bold')
    pdf.text(label, metaLabelX, metaY)
    setFont(pdf, 'normal')
    pdf.text(value, metaValueX, metaY)
    if (label === 'Seite:') seiteY = metaY
    metaY += 5
  }

  return { y: Math.max(metaY, y) + 8, metaLabelX, metaValueX, seiteY }
}

// Label/value rows under the document title; long values (e.g. many delivery
// note numbers) wrap instead of running off the page. Returns the next y.
function drawDetailRows(pdf: jsPDF, left: number, right: number, y: number, rows: Array<[string, string]>) {
  pdf.setFontSize(9.5)
  setFont(pdf, 'bold')
  const valueX = left + Math.max(...rows.map(([label]) => pdf.getTextWidth(label))) + 3
  for (const [label, value] of rows) {
    setFont(pdf, 'bold')
    pdf.text(label, left, y)
    setFont(pdf, 'normal')
    const lines: string[] = pdf.splitTextToSize(value, right - valueX)
    pdf.text(lines, valueX, y)
    y += 5 * lines.length
  }
  return y
}

// Documents generated against the local development database get a diagonal
// watermark on every page, so they can't be mistaken for (or sent as) real ones.
function drawDevelopmentWatermark(pdf: jsPDF) {
  if (!isDevelopmentDatabase) return
  pdf.saveGraphicsState()
  pdf.setGState(new GState({ opacity: 0.18 }))
  setFont(pdf, 'bold')
  pdf.setFontSize(46)
  pdf.setTextColor(220, 38, 38)
  pdf.text('ENTWICKLUNG', 105, 150, { align: 'center', angle: 35 })
  pdf.setFontSize(20)
  pdf.text('kein gültiger Beleg', 118, 168, { align: 'center', angle: 35 })
  pdf.restoreGraphicsState()
  pdf.setTextColor(0)
}

function finishPages(pdf: jsPDF, right: number, meta: { metaLabelX: number; metaValueX: number; seiteY: number }) {
  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    drawCompanyFooter(pdf)
    drawDevelopmentWatermark(pdf)
  }

  if (totalPages > 1) {
    pdf.setPage(1)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(meta.metaLabelX, meta.seiteY - 3.5, right - meta.metaLabelX, 5, 'F')
    setFont(pdf, 'bold')
    pdf.setFontSize(9)
    pdf.text('Seite:', meta.metaLabelX, meta.seiteY)
    setFont(pdf, 'normal')
    pdf.text(`1 von ${totalPages}`, meta.metaValueX, meta.seiteY)
  }
}

// Line items and totals of an invoice — shared by the PDF and the ZUGFeRD
// data embedded in it, so both always show the same amounts.
export function computeInvoiceTotals(invoiceRecords: RecordItem[], reverseCharge: boolean) {
  const lineItems = aggregateInvoiceLineItems(invoiceRecords).map((item) => ({ ...item, total: roundCents(item.total) }))
  const subtotal = lineItems.reduce((sum, item) => roundCents(sum + item.total), 0)
  const vat = reverseCharge ? 0 : roundCents(subtotal * VAT_RATE)
  return { lineItems, subtotal, vat, gross: roundCents(subtotal + vat) }
}

export type InvoicePdfInput = {
  records: RecordItem[]
  customer: InvoiceCustomer | undefined
  /** Delivery note numbers, comma separated. */
  deliveryNoteRefs: string | undefined
  invoiceNo: string
  reverseCharge: boolean
  logoDataUrl: string
}

export function invoicePdfFileName(invoiceNo: string) {
  return `rechnung-${toSafeFileDate(invoiceNo)}.pdf`
}

// Draws the invoice into `pdf` (rendered on the server, see
// src/server/invoice-documents.server.ts).
export function drawInvoicePdf(pdf: jsPDF, input: InvoicePdfInput) {
  const { records: invoiceRecords, customer, deliveryNoteRefs: deliveryNoteId, invoiceNo, reverseCharge, logoDataUrl } = input
  const left = 15
  const right = 195

  const customerName = invoiceRecords[0].company
  const invoiceDate = documentDate(invoiceRecords[0].invoicedAt)

  const metaRows: Array<[string, string]> = [
    ['Rechnungs-Nr.:', invoiceNo],
    ['Datum:', invoiceDate],
  ]
  if (customer?.customerNumber) metaRows.push(['Kunden-Nr.:', customer.customerNumber])
  metaRows.push(['Seite:', '1 von 1'])

  const meta = drawRecipientAndMeta(pdf, left, right, logoDataUrl, customerName, customer, metaRows)
  let y = meta.y
  setFont(pdf, 'bold')
  pdf.setFontSize(20)
  pdf.text(reverseCharge ? 'Rechnung §13b' : 'Rechnung', left, y)

  y += 9
  const siteNames = new Set(invoiceRecords.map((r) => r.constructionSiteName || '-'))
  const bauvorhaben = siteNames.size === 1 ? [...siteNames][0] : 'Diverse Baustellen'
  const zeitraum = servicePeriod(invoiceRecords)

  const detailRows: Array<[string, string]> = [
    ['Bauvorhaben:', bauvorhaben],
    ['Ausführungszeitraum:', zeitraum],
  ]
  if (deliveryNoteId) detailRows.push(['Lieferschein-Nr.:', deliveryNoteId])
  y = drawDetailRows(pdf, left, right, y, detailRows) - 5

  y += 9
  pdf.setFontSize(9.5)
  setFont(pdf, 'normal')
  pdf.text('Wir bedanken uns für die gute Zusammenarbeit und stellen Ihnen folgende Leistungen in Rechnung:', left, y)

  y += 8

  const cols = {
    pos: left,
    bezeichnung: left + 10,
    anzahl: 120,
    einheit: 126,
    einzelpreis: 155,
    gesamtpreis: right,
  }

  setFont(pdf, 'bold')
  pdf.setFontSize(9)
  pdf.setFillColor(191, 191, 191)
  pdf.rect(left, y - 4.5, right - left, 6.5, 'F')
  pdf.text('Pos.', cols.pos, y)
  pdf.text('Bezeichnung', cols.bezeichnung, y)
  pdf.text('Anzahl', cols.anzahl, y, { align: 'right' })
  pdf.text('Einheit', cols.einheit, y)
  pdf.text('Einzelpreis', cols.einzelpreis, y, { align: 'right' })
  pdf.text('Gesamtpreis', cols.gesamtpreis, y, { align: 'right' })

  y += 2.5
  pdf.setDrawColor(180)
  pdf.line(left, y, right, y)
  y += 7

  const { lineItems, subtotal, vat, gross } = computeInvoiceTotals(invoiceRecords, reverseCharge)
  setFont(pdf, 'normal')
  pdf.setFontSize(9)

  for (const [index, item] of lineItems.entries()) {
    if (y > 245) {
      pdf.addPage()
      y = 20
    }

    const service = `${flowLabel(item.type)}: ${item.productName}`
    const serviceShort = service.length > 44 ? `${service.slice(0, 41)}...` : service

    pdf.text(`${index + 1}.`, cols.pos, y)
    pdf.text(serviceShort, cols.bezeichnung, y)
    pdf.text(formatQty(item.amount), cols.anzahl, y, { align: 'right' })
    pdf.text(item.unit, cols.einheit, y)
    pdf.text(money(item.unitPrice), cols.einzelpreis, y, { align: 'right' })
    pdf.text(money(item.total), cols.gesamtpreis, y, { align: 'right' })

    y += 7
  }

  if (y > 220) {
    pdf.addPage()
    y = 20
  }

  y += 3
  pdf.setDrawColor(0)
  pdf.line(left, y, right, y)
  y += 7

  setFont(pdf, 'bold')
  pdf.setFontSize(11)

  if (reverseCharge) {
    pdf.text('Gesamtbetrag', cols.pos, y)
    pdf.text(money(subtotal), cols.gesamtpreis, y, { align: 'right' })
    y += 1
    pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

    y += 10
    setFont(pdf, 'bold')
    pdf.setFontSize(9.5)
    pdf.text('Bei den oben genannten Leistungen handelt es sich um eine Bauleistung im Sinne von § 13b UStG', left, y)
    y += 5
    pdf.text('Es liegt eine Steuerschuldnerschaft des Leistungsempfängers vor', left, y)
    y += 9
    pdf.text('Zahlbar innerhalb von 14 Tagen ab Rechnungsstellung', left, y)
  } else {
    setFont(pdf, 'normal')
    pdf.setFontSize(10)
    pdf.text('Zwischensumme (netto)', cols.pos, y)
    pdf.text(money(subtotal), cols.gesamtpreis, y, { align: 'right' })
    y += 6
    pdf.text(`zzgl. ${Math.round(VAT_RATE * 100)}% USt.`, cols.pos, y)
    pdf.text(money(vat), cols.gesamtpreis, y, { align: 'right' })
    y += 7
    setFont(pdf, 'bold')
    pdf.setFontSize(11)
    pdf.text('Gesamtbetrag', cols.pos, y)
    pdf.text(money(gross), cols.gesamtpreis, y, { align: 'right' })
    y += 1
    pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

    y += 10
    setFont(pdf, 'bold')
    pdf.setFontSize(9.5)
    pdf.text('Zahlbar innerhalb von 14 Tagen ab Rechnungsstellung', left, y)
  }

  finishPages(pdf, right, meta)
}

// Cancellation document for either one invoice (Stornorechnung, mirrors the
// invoice's VAT treatment incl. §13b) or not-yet-invoiced delivery notes
// (Storno Lieferschein, net amounts only — no VAT was ever charged).
// Storno of not-yet-invoiced delivery notes, generated in the browser.
// Cancellations of invoices (Stornorechnung, an e-invoice) come from the
// server, see downloadCancellationPdf in invoice-download.ts.
export async function downloadStornoDoc(records: RecordItem[], customer?: InvoiceCustomer) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  drawStornoPdf(pdf, { records, customer, logoDataUrl: await loadLogoDataUrl() })
  pdf.save(stornoPdfFileName(records[0].cancelId ?? ''))
}

export function stornoPdfFileName(cancelId: string) {
  return `storno-${toSafeFileDate(cancelId)}.pdf`
}

// Wording follows the rules for correcting an invoice: it names the original
// invoice (number and date), shows the reversed amounts including VAT and
// avoids "Gutschrift", which in German VAT law means self-billing by the
// customer (§ 14 Abs. 2 UStG).
export function drawStornoPdf(
  pdf: jsPDF,
  input: { records: RecordItem[]; customer: InvoiceCustomer | undefined; logoDataUrl: string },
) {
  const { records, customer, logoDataUrl } = input
  const left = 15
  const right = 195

  const cancelId = records[0].cancelId ?? ''
  const invoiceId = records[0].invoiceId
  const isInvoiceCancellation = Boolean(invoiceId)
  const reverseCharge = isInvoiceCancellation && Boolean(records[0].invoiceReverseCharge)
  const deliveryNoteIds = [...new Set(records.map((r) => r.deliveryNoteId).filter(Boolean))].join(', ')

  const metaRows: Array<[string, string]> = [
    ['Storno-Nr.:', cancelId],
    ['Datum:', documentDate(records[0].cancelledAt)],
  ]
  if (customer?.customerNumber) metaRows.push(['Kunden-Nr.:', customer.customerNumber])
  metaRows.push(['Seite:', '1 von 1'])

  const meta = drawRecipientAndMeta(pdf, left, right, logoDataUrl, records[0].company, customer, metaRows)
  let y = meta.y

  setFont(pdf, 'bold')
  pdf.setFontSize(20)
  pdf.text(isInvoiceCancellation ? (reverseCharge ? 'Stornorechnung §13b' : 'Stornorechnung') : 'Storno Lieferschein', left, y)

  y += 9
  const details: Array<[string, string]> = isInvoiceCancellation
    ? [['Storno zu Rechnung:', `${invoiceId ?? ''} vom ${documentDate(records[0].invoicedAt)}`]]
    : [['Storno zu Lieferschein:', deliveryNoteIds]]
  if (isInvoiceCancellation && deliveryNoteIds) details.push(['Lieferschein-Nr.:', deliveryNoteIds])
  details.push(['Ausführungszeitraum:', servicePeriod(records)])

  y = drawDetailRows(pdf, left, right, y, details)

  y += 4
  pdf.text(
    isInvoiceCancellation
      ? 'Hiermit stornieren wir die oben genannte Rechnung vollständig. Folgende Positionen werden berichtigt:'
      : 'Hiermit stornieren wir den oben genannten Lieferschein vollständig:',
    left,
    y,
  )

  y += 8
  const cols = {
    pos: left,
    datum: left + 10,
    bezeichnung: left + 32,
    anzahl: 130,
    einheit: 133,
    einzelpreis: 165,
    gesamtpreis: right,
  }

  function drawTableHeader() {
    setFont(pdf, 'bold')
    pdf.setFontSize(9)
    pdf.setFillColor(191, 191, 191)
    pdf.rect(left, y - 4.5, right - left, 6.5, 'F')
    pdf.text('Pos.', cols.pos, y)
    pdf.text('Datum', cols.datum, y)
    pdf.text('Bezeichnung', cols.bezeichnung, y)
    pdf.text('Anzahl', cols.anzahl, y, { align: 'right' })
    pdf.text('Einheit', cols.einheit, y)
    pdf.text('Einzelpreis', cols.einzelpreis, y, { align: 'right' })
    pdf.text('Gesamtpreis', cols.gesamtpreis, y, { align: 'right' })
    y += 2.5
    pdf.setDrawColor(180)
    pdf.line(left, y, right, y)
    y += 7
    setFont(pdf, 'normal')
  }

  drawTableHeader()

  let subtotal = 0
  for (const [index, record] of records.entries()) {
    if (y > 245) {
      pdf.addPage()
      y = 20
      drawTableHeader()
    }

    subtotal = roundCents(subtotal + record.total)
    const service = `${flowLabel(record.type)}: ${record.productName}`
    const serviceShort = service.length > 40 ? `${service.slice(0, 37)}...` : service

    pdf.setFontSize(9)
    pdf.text(`${index + 1}.`, cols.pos, y)
    pdf.text(formatBerlinDate(record.createdAtIso), cols.datum, y)
    pdf.text(serviceShort, cols.bezeichnung, y)
    pdf.text(formatQty(record.amount), cols.anzahl, y, { align: 'right' })
    pdf.text(record.unit, cols.einheit, y)
    pdf.text(money(record.unitPrice), cols.einzelpreis, y, { align: 'right' })
    pdf.text(money(-record.total), cols.gesamtpreis, y, { align: 'right' })
    y += 7
  }

  if (y > 220) {
    pdf.addPage()
    y = 20
  }

  y += 3
  pdf.setDrawColor(0)
  pdf.line(left, y, right, y)
  y += 7

  if (isInvoiceCancellation && !reverseCharge) {
    const vat = roundCents(subtotal * VAT_RATE)
    const gross = roundCents(subtotal + vat)

    setFont(pdf, 'normal')
    pdf.setFontSize(10)
    pdf.text('Zwischensumme (netto)', cols.pos, y)
    pdf.text(money(-subtotal), cols.gesamtpreis, y, { align: 'right' })
    y += 6
    pdf.text(`Umsatzsteuer ${Math.round(VAT_RATE * 100)}%`, cols.pos, y)
    pdf.text(money(-vat), cols.gesamtpreis, y, { align: 'right' })
    y += 7
    setFont(pdf, 'bold')
    pdf.setFontSize(11)
    pdf.text('Stornobetrag (brutto)', cols.pos, y)
    pdf.text(money(-gross), cols.gesamtpreis, y, { align: 'right' })
  } else {
    setFont(pdf, 'bold')
    pdf.setFontSize(11)
    pdf.text(isInvoiceCancellation ? 'Stornobetrag' : 'Gesamtbetrag (netto)', cols.pos, y)
    pdf.text(money(-subtotal), cols.gesamtpreis, y, { align: 'right' })
  }
  y += 1
  pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

  if (reverseCharge) {
    y += 10
    pdf.setFontSize(9.5)
    pdf.text('Bei den oben genannten Leistungen handelt es sich um eine Bauleistung im Sinne von § 13b UStG', left, y)
    y += 5
    pdf.text('Es liegt eine Steuerschuldnerschaft des Leistungsempfängers vor', left, y)
  }

  if (isInvoiceCancellation) {
    y += 10
    setFont(pdf, 'normal')
    pdf.setFontSize(9.5)
    const note = pdf.splitTextToSize(
      `Diese Stornorechnung hebt die Rechnung ${invoiceId} vom ${documentDate(records[0].invoicedAt)} vollständig auf. ` +
        (reverseCharge ? '' : 'Die dort ausgewiesene Umsatzsteuer wird in gleicher Höhe berichtigt. ') +
        'Bitte buchen Sie die Rechnung entsprechend aus.',
      right - left,
    )
    pdf.text(note, left, y)
  }

  finishPages(pdf, right, meta)
}

export function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function drawDeliveryNoteSignatureBlock(pdf: jsPDF, left: number, right: number) {
  const y = 244
  setFont(pdf, 'italic')
  pdf.setFontSize(9.5)
  pdf.setTextColor(0)
  pdf.text('Ware ordnungsgemäß erhalten.', left, y)

  const dashY = y + 12
  pdf.setDrawColor(0)
  pdf.setLineDashPattern([2, 1.5], 0)
  pdf.line(left, dashY, right, dashY)
  pdf.setLineDashPattern([], 0)

  pdf.setFontSize(9)
  pdf.text('Datum', left, dashY + 5)
  pdf.text('Unterschrift', left + 70, dashY + 5)
  setFont(pdf, 'normal')
}

export async function downloadCombinedDeliveryNote(
  records: RecordItem[],
  companyName: string,
  deliveryNoteId?: string,
  customer?: InvoiceCustomer,
) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  const right = 195

  const logoDataUrl = await loadLogoDataUrl()
  const date = latestRecordDate(records)
  const siteNames = new Set(records.map((r) => r.constructionSiteName || '-'))
  const bauvorhaben = siteNames.size === 1 ? [...siteNames][0] : 'Diverse Baustellen'

  const cols = {
    pos: left,
    bezeichnung: left + 10,
    anzahl: 120,
    einheit: 126,
    einzelpreis: 155,
    gesamtpreis: right,
  }

  const metaLabelX = 122
  const metaLabels = ['Lieferschein-Nr.:', 'Datum:', 'Kunden-Nr.:', 'Seite:']
  setFont(pdf, 'bold')
  pdf.setFontSize(9)
  const metaValueX = metaLabelX + Math.max(...metaLabels.map((label) => pdf.getTextWidth(label))) + 3

  function drawPageHeader(isFirstPage: boolean) {
    const addressBottom = drawLetterhead(pdf, left, right, logoDataUrl)

    let addressY = 38 + 7
    setFont(pdf, 'normal')
    pdf.setFontSize(11)
    pdf.text(companyName, left, addressY)

    if (customer?.street) {
      addressY += 5
      pdf.text(customer.street, left, addressY)
    }

    const customerPostalCodeAndCity = [customer?.postalCode, customer?.city].filter(Boolean).join(' ')
    if (customerPostalCodeAndCity) {
      addressY += 5
      pdf.text(customerPostalCodeAndCity, left, addressY)
    }

    const metaValues = [deliveryNoteId ?? '', date, customer?.customerNumber ?? '', '']
    let metaY = Math.max(addressBottom, addressY) + 8
    let seiteY = metaY
    for (const [index, label] of metaLabels.entries()) {
      setFont(pdf, 'bold')
      pdf.setFontSize(9)
      pdf.text(label, metaLabelX, metaY)
      setFont(pdf, 'normal')
      pdf.text(metaValues[index], metaValueX, metaY)
      if (label === 'Seite:') seiteY = metaY
      metaY += 5
    }

    let y = metaY + 3
    if (isFirstPage) {
      setFont(pdf, 'bold')
      pdf.setFontSize(20)
      pdf.text('Lieferschein', left, y)
      y += 9
      pdf.setFontSize(9.5)
      pdf.text('Kunde:', left, y)
      setFont(pdf, 'normal')
      pdf.text(companyName, left + pdf.getTextWidth('Bauvorhaben:') + 3, y)
      y += 5
      setFont(pdf, 'bold')
      pdf.text('Bauvorhaben:', left, y)
      setFont(pdf, 'normal')
      pdf.text(bauvorhaben, left + pdf.getTextWidth('Bauvorhaben:') + 3, y)
      y += 8
    }

    setFont(pdf, 'bold')
    pdf.setFontSize(9)
    pdf.setFillColor(191, 191, 191)
    pdf.rect(left, y - 4.5, right - left, 6.5, 'F')
    pdf.text('Pos.', cols.pos + 1, y)
    pdf.text('Bezeichnung', cols.bezeichnung, y)
    pdf.text('Anzahl', cols.anzahl, y, { align: 'right' })
    pdf.text('Einheit', cols.einheit, y)
    pdf.text('Einzelpreis', cols.einzelpreis, y, { align: 'right' })
    pdf.text('Gesamtpreis', cols.gesamtpreis, y, { align: 'right' })
    y += 7

    return { tableTop: y, seiteY }
  }

  let { tableTop: y, seiteY } = drawPageHeader(true)
  const seiteYs = [seiteY]

  let total = 0
  setFont(pdf, 'normal')
  pdf.setFontSize(9)

  for (const [index, record] of records.entries()) {
    if (y > 235) {
      pdf.addPage()
      const header = drawPageHeader(false)
      y = header.tableTop
      seiteYs.push(header.seiteY)
      setFont(pdf, 'normal')
      pdf.setFontSize(9)
    }

    total = roundCents(total + record.total)

    const service = `${flowLabel(record.type)}: ${record.productName}`
    const serviceShort = service.length > 44 ? `${service.slice(0, 41)}...` : service

    pdf.text(`${index + 1}.`, cols.pos, y)
    pdf.text(serviceShort, cols.bezeichnung, y)
    pdf.text(formatQty(record.amount), cols.anzahl, y, { align: 'right' })
    pdf.text(record.unit, cols.einheit, y)
    pdf.text(money(record.unitPrice), cols.einzelpreis, y, { align: 'right' })
    pdf.text(money(record.total), cols.gesamtpreis, y, { align: 'right' })

    y += 7
  }

  if (y > 225) {
    pdf.addPage()
    const header = drawPageHeader(false)
    y = header.tableTop
    seiteYs.push(header.seiteY)
  }

  y += 3
  pdf.setDrawColor(0)
  pdf.line(left, y, right, y)
  y += 7

  setFont(pdf, 'bold')
  pdf.setFontSize(11)
  pdf.text('Gesamtbetrag', cols.pos, y)
  pdf.text(money(total), cols.gesamtpreis, y, { align: 'right' })
  y += 1
  pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    if (page === 1) drawDeliveryNoteSignatureBlock(pdf, left, right)
    drawCompanyFooter(pdf)
    drawDevelopmentWatermark(pdf)
  }

  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(metaValueX - 1, seiteYs[page - 1] - 3.5, right - metaValueX + 1, 5, 'F')
    setFont(pdf, 'normal')
    pdf.setFontSize(9)
    pdf.text(`${page} von ${totalPages}`, metaValueX, seiteYs[page - 1])
  }

  const fileName = deliveryNoteId
    ? `lieferschein-${toSafeFileDate(deliveryNoteId)}.pdf`
    : `lieferschein-sammel-${toSafeFileDate(date)}.pdf`
  pdf.save(fileName)
}
