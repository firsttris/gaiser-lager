import { getInvoicePdf } from '../server/invoice-pdf'
import type { RecordItem } from '../state/app-state'
import { downloadStornoDoc, type InvoiceCustomer } from './delivery-note-utils'

export async function downloadInvoicePdf(invoiceId: string, kind: 'invoice' | 'cancellation' = 'invoice') {
  const { base64, fileName } = await getInvoicePdf({ data: { invoiceId, kind } })
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Storno document: the Stornorechnung of an invoice comes from the server
// (e-invoice), the storno of plain delivery notes is drawn in the browser.
export async function downloadCancellationPdf(records: RecordItem[], customer?: InvoiceCustomer) {
  const invoiceId = records[0]?.invoiceId
  if (invoiceId) await downloadInvoicePdf(invoiceId, 'cancellation')
  else await downloadStornoDoc(records, customer)
}
