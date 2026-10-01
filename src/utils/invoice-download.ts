import { getInvoicePdf } from '../server/invoice-pdf'

export async function downloadInvoicePdf(invoiceId: string) {
  const { base64, fileName } = await getInvoicePdf({ data: { invoiceId } })
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
