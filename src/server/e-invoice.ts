// ZUGFeRD e-invoice (EN 16931, PDF/A-3): the invoice PDF with the invoice data
// embedded as XML. Also the cancellation of an invoice (Stornorechnung,
// type 381 with positive amounts and a reference to the original invoice). Pure functions; loading from the database is in
// invoice-documents.server.ts.
import { jsPDF } from 'jspdf'
import {
  DocumentTypeCode,
  embedFacturX,
  type FacturXInvoiceInput,
  Flavor,
  Profile,
  UnitCode,
  VatCategoryCode,
} from '@stackforge-eu/factur-x'
import logoDataUrl from '#/assets/pdf/Logo.jpeg?inline'
import regularFontDataUrl from '#/assets/pdf/LiberationSans-Regular.ttf?inline'
import boldFontDataUrl from '#/assets/pdf/LiberationSans-Bold.ttf?inline'
import { SRGB_ICC_BASE64 } from '#/assets/pdf/srgb-icc'
import type { RecordItem } from '#/state/app-state'
import { flowLabel } from '#/utils/history-utils'
import { berlinIsoDate } from '#/utils/berlin-time'
import { VAT_RATE } from '#/utils/money'
import {
  COMPANY_INFO,
  computeInvoiceTotals,
  drawInvoicePdf,
  drawStornoPdf,
  EMBEDDED_FONT_FAMILY,
  invoicePdfFileName,
  stornoPdfFileName,
} from '#/utils/delivery-note-utils'

// Invoices are payable within 14 days (printed on the invoice).
export const PAYMENT_TERM_DAYS = 14

const UNIT_CODES: Record<string, string> = {
  t: UnitCode.TONNE,
  'm³': 'MTQ',
  'Std.': UnitCode.HOUR,
}

function dataUrlBase64(dataUrl: string) {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}


function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export type InvoiceDocument = {
  invoiceId: string
  records: RecordItem[]
  company: { id: string; name: string; customerNumber: string; street: string; postalCode: string; city: string; email: string | null }
  reverseCharge: boolean
  /** Issue date, YYYY-MM-DD (Berlin). */
  issueDate: string
  dueDate: string
  deliveryNoteRefs: string
  constructionSites: string
  totals: ReturnType<typeof computeInvoiceTotals>
  /** Set when this is the cancellation (Stornorechnung) of the invoice. */
  cancellation: { cancelId: string; issueDate: string } | null
}

export type InvoiceCompany = InvoiceDocument['company']

// Everything the invoice PDF and its ZUGFeRD data are made from.
export function buildInvoiceDocument(invoiceId: string, records: RecordItem[], company: Omit<InvoiceCompany, 'id' | 'name'>): InvoiceDocument {
  const reverseCharge = Boolean(records[0].invoiceReverseCharge)
  const issueDate = berlinIsoDate(records[0].invoicedAt ? new Date(records[0].invoicedAt) : new Date())
  const siteNames = [...new Set(records.map((r) => r.constructionSiteName || '-'))]

  return {
    invoiceId,
    records,
    company: { id: records[0].companyId, name: records[0].company, ...company },
    reverseCharge,
    issueDate,
    dueDate: addDays(issueDate, PAYMENT_TERM_DAYS),
    deliveryNoteRefs: [...new Set(records.map((r) => r.deliveryNoteId).filter(Boolean))].join(', '),
    constructionSites: siteNames.length === 1 ? siteNames[0] : 'Diverse Baustellen',
    totals: computeInvoiceTotals(records, reverseCharge),
    cancellation: null,
  }
}

// The Stornorechnung of a cancelled invoice: same customer, positions and
// amounts as the invoice (cancellations always cover a whole invoice).
export function buildCancellationDocument(
  records: RecordItem[],
  company: Omit<InvoiceCompany, 'id' | 'name'>,
): InvoiceDocument | null {
  const { invoiceId, cancelId, cancelledAt } = records[0]
  if (!invoiceId || !cancelId) return null
  return {
    ...buildInvoiceDocument(invoiceId, records, company),
    cancellation: { cancelId, issueDate: berlinIsoDate(cancelledAt ? new Date(cancelledAt) : new Date()) },
  }
}

/** Number of the document itself (Storno-Nr. for a cancellation). */
export function documentNumber(doc: InvoiceDocument) {
  return doc.cancellation?.cancelId ?? doc.invoiceId
}

/**
 * Why an invoice can't carry ZUGFeRD data (the PDF is still produced).
 * Empty = it can.
 */
export function eInvoiceProblems(doc: InvoiceDocument): string[] {
  const problems: string[] = []
  if (doc.reverseCharge) problems.push('Alte §13b-Rechnung (ohne USt-IdNr. des Kunden keine E-Rechnung möglich)')
  if (!doc.company.street.trim() || !doc.company.postalCode.trim() || !doc.company.city.trim()) {
    problems.push('Anschrift des Kunden unvollständig (Straße, PLZ, Ort)')
  }
  return problems
}

function toFacturXInput(doc: InvoiceDocument): FacturXInvoiceInput {
  const { lineItems, subtotal, vat, gross } = doc.totals
  const vatPercent = Math.round(VAT_RATE * 100)
  const serviceDates = doc.records.map((r) => berlinIsoDate(new Date(r.createdAtIso))).sort()
  const notes = [{ content: `Bauvorhaben: ${doc.constructionSites}` }]
  if (doc.deliveryNoteRefs) notes.push({ content: `Lieferschein-Nr.: ${doc.deliveryNoteRefs}` })
  const cancellation = doc.cancellation
  if (cancellation) {
    notes.unshift({
      content: `Stornorechnung: hebt die Rechnung ${doc.invoiceId} vom ${doc.issueDate} vollständig auf. Die dort ausgewiesene Umsatzsteuer wird in gleicher Höhe berichtigt.`,
    })
  }
  // A cancellation lists every Vorgang (like its PDF), an invoice the
  // aggregated positions.
  const lines = cancellation
    ? doc.records.map((record) => ({
        type: record.type,
        productName: record.productName,
        unit: record.unit,
        unitPrice: record.unitPrice,
        amount: record.amount,
        total: record.total,
      }))
    : lineItems
  const payment = {
    meansCode: '58',
    iban: COMPANY_INFO.banks[0].iban.replace(/\s/g, ''),
    bic: COMPANY_INFO.banks[0].bic,
    accountName: COMPANY_INFO.name,
    paymentReference: doc.invoiceId,
    dueDate: doc.dueDate,
    termsDescription: `Zahlbar innerhalb von ${PAYMENT_TERM_DAYS} Tagen ab Rechnungsstellung`,
  }

  return {
    document: {
      id: documentNumber(doc),
      issueDate: cancellation?.issueDate ?? doc.issueDate,
      typeCode: cancellation ? DocumentTypeCode.CREDIT_NOTE : DocumentTypeCode.COMMERCIAL_INVOICE,
      buyerReference: doc.company.customerNumber || undefined,
      notes: [
        ...notes,
        {
          content: `${COMPANY_INFO.name}, ${COMPANY_INFO.street}, ${COMPANY_INFO.city}. ${COMPANY_INFO.management}`,
          subjectCode: 'REG',
        },
      ],
    },
    seller: {
      name: COMPANY_INFO.name,
      address: {
        line1: COMPANY_INFO.street,
        postalCode: COMPANY_INFO.city.split(' ')[0],
        city: COMPANY_INFO.city.split(' ').slice(1).join(' '),
        country: 'DE',
      },
      contact: { name: COMPANY_INFO.name, phone: COMPANY_INFO.phone, email: COMPANY_INFO.email },
      electronicAddress: { value: COMPANY_INFO.email, schemeID: 'EM' },
      taxRegistrations: [{ id: COMPANY_INFO.vatId, schemeId: 'VA' }],
    },
    buyer: {
      name: doc.company.name,
      id: doc.company.customerNumber || undefined,
      address: {
        line1: doc.company.street,
        postalCode: doc.company.postalCode,
        city: doc.company.city,
        country: 'DE',
      },
      electronicAddress: doc.company.email ? { value: doc.company.email, schemeID: 'EM' } : undefined,
    },
    references: cancellation ? [{ id: doc.invoiceId, type: 'preceding', issueDate: doc.issueDate }] : undefined,
    lines: lines.map((item, index) => ({
      id: String(index + 1),
      name: `${flowLabel(item.type)}: ${item.productName}`,
      quantity: Math.round(item.amount * 1000) / 1000,
      unitCode: UNIT_CODES[item.unit] ?? UnitCode.UNIT,
      unitPrice: item.unitPrice,
      lineTotal: item.total,
      vatCategoryCode: VatCategoryCode.STANDARD_RATE,
      vatRatePercent: vatPercent,
    })),
    billingPeriod: { startDate: serviceDates[0], endDate: serviceDates[serviceDates.length - 1] },
    // A cancellation asks for no payment.
    payment: cancellation ? undefined : payment,
    totals: {
      lineTotal: subtotal,
      taxBasisTotal: subtotal,
      taxTotal: vat,
      grandTotal: gross,
      duePayableAmount: gross,
      currency: 'EUR',
    },
    vatBreakdown: [
      { categoryCode: VatCategoryCode.STANDARD_RATE, ratePercent: vatPercent, taxableAmount: subtotal, taxAmount: vat },
    ],
  }
}

function documentTitle(doc: InvoiceDocument) {
  return doc.cancellation ? `Stornorechnung ${doc.cancellation.cancelId}` : `Rechnung ${doc.invoiceId}`
}

function renderInvoicePdfBytes(doc: InvoiceDocument) {
  // putOnlyUsedFonts: jsPDF otherwise lists its 14 standard fonts, which
  // PDF/A forbids because they aren't embedded.
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true })
  pdf.addFileToVFS('LiberationSans-Regular.ttf', dataUrlBase64(regularFontDataUrl))
  pdf.addFont('LiberationSans-Regular.ttf', EMBEDDED_FONT_FAMILY, 'normal')
  pdf.addFileToVFS('LiberationSans-Bold.ttf', dataUrlBase64(boldFontDataUrl))
  pdf.addFont('LiberationSans-Bold.ttf', EMBEDDED_FONT_FAMILY, 'bold')

  const customer = {
    customerNumber: doc.company.customerNumber,
    street: doc.company.street,
    postalCode: doc.company.postalCode,
    city: doc.company.city,
  }
  if (doc.cancellation) {
    drawStornoPdf(pdf, { records: doc.records, customer, logoDataUrl })
  } else {
    drawInvoicePdf(pdf, {
      records: doc.records,
      customer,
      deliveryNoteRefs: doc.deliveryNoteRefs,
      invoiceNo: doc.invoiceId,
      reverseCharge: doc.reverseCharge,
      logoDataUrl,
    })
  }
  pdf.setProperties({ title: documentTitle(doc), author: COMPANY_INFO.name, creator: COMPANY_INFO.name })
  return new Uint8Array(pdf.output('arraybuffer'))
}

export type RenderedInvoice = {
  pdf: Uint8Array
  fileName: string
  /** True when the PDF carries ZUGFeRD (EN 16931) data. */
  eInvoice: boolean
  problems: string[]
}

// The invoice PDF; a ZUGFeRD e-invoice (PDF/A-3 with embedded XML) whenever
// the data allows it.
export async function renderInvoice(doc: InvoiceDocument): Promise<RenderedInvoice> {
  const plainPdf = renderInvoicePdfBytes(doc)
  const fileName = doc.cancellation ? stornoPdfFileName(doc.cancellation.cancelId) : invoicePdfFileName(doc.invoiceId)
  const problems = eInvoiceProblems(doc)
  if (problems.length) return { pdf: plainPdf, fileName, eInvoice: false, problems }

  const result = await embedFacturX({
    pdf: plainPdf,
    input: toFacturXInput(doc),
    profile: Profile.EN16931,
    flavor: Flavor.ZUGFERD,
    rgbIccProfile: Buffer.from(SRGB_ICC_BASE64, 'base64'),
    unembeddedFonts: 'throw',
    meta: { title: documentTitle(doc), author: COMPANY_INFO.name, creator: COMPANY_INFO.name },
  })
  if (result.validation && !result.validation.valid) {
    throw new Error(`E-Rechnung ungültig: ${JSON.stringify(result.validation.errors)}`)
  }
  return { pdf: result.pdf, fileName, eInvoice: true, problems: [] }
}
