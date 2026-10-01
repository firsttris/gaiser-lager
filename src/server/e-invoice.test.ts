import { describe, expect, it } from 'vitest'
import { extractXml, Profile, validateXsd } from '@stackforge-eu/factur-x'
import type { RecordItem } from '#/state/app-state'
import { buildInvoiceDocument, renderInvoice } from './e-invoice'

function record(overrides: Partial<RecordItem>): RecordItem {
  return {
    id: 1,
    companyId: '11111111-1111-1111-1111-111111111111',
    company: 'Muster Bau GmbH',
    constructionSiteName: 'Nordring 12',
    type: 'pickup',
    productName: 'Sand 0/2',
    amount: 1,
    unit: 't',
    unitPrice: 24.4,
    total: 24.4,
    status: 'rechnung',
    createdAt: '',
    createdAtIso: '2026-09-28T07:00:00Z',
    deliveryNoteId: 'LS-1',
    invoiceId: 'RG-1',
    invoicedAt: '2026-10-01T08:00:00Z',
    ...overrides,
  } as RecordItem
}

const company = {
  customerNumber: '10600',
  street: 'Industriestraße 5',
  postalCode: '77815',
  city: 'Bühl',
  email: 'buchhaltung@muster.example',
}

const records = [
  record({}),
  // Same product and price: aggregated into one line (3,5 t).
  record({ id: 2, amount: 2.5, total: 61, deliveryNoteId: 'LS-2', createdAtIso: '2026-09-30T07:00:00Z' }),
  record({ id: 3, type: 'dropoff', productName: 'Aushub', amount: 7.35, unit: 'm³', unitPrice: 60, total: 441 }),
  record({ id: 4, type: 'lkw', productName: 'LKW 3-Achser', amount: 2.5, unit: 'Std.', unitPrice: 95, total: 237.5 }),
]

describe('ZUGFeRD e-invoice', () => {
  it('embeds EN 16931 data with the same amounts as the PDF', async () => {
    const doc = buildInvoiceDocument('RG-1', records, company)
    expect(doc.totals).toMatchObject({ subtotal: 763.9, vat: 145.14, gross: 909.04 })
    expect(doc.dueDate).toBe('2026-10-15')

    const rendered = await renderInvoice(doc)
    expect(rendered.eInvoice).toBe(true)

    const { xml } = await extractXml(rendered.pdf)
    expect(xml).toContain('urn:cen.eu:en16931:2017')
    expect(xml).toContain('<ram:GrandTotalAmount>909.04</ram:GrandTotalAmount>')
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">145.14</ram:TaxTotalAmount>')
    expect(xml).toContain('unitCode="MTQ"')
    expect(xml).toContain('<ram:BilledQuantity unitCode="TNE">3.5</ram:BilledQuantity>')
    expect(xml).toContain('DE338636212')
    expect(xml).toContain('<udt:DateTimeString format="102">20261015</udt:DateTimeString>')

    const xsd = await validateXsd(xml, Profile.EN16931)
    expect(xsd.errors).toEqual([])
  })

  it('falls back to a plain PDF when the customer address is missing', async () => {
    const rendered = await renderInvoice(buildInvoiceDocument('RG-2', records, { ...company, street: '' }))
    expect(rendered.eInvoice).toBe(false)
    expect(rendered.problems[0]).toContain('Anschrift')
  })

  it('keeps old §13b invoices as plain PDFs', async () => {
    const rendered = await renderInvoice(
      buildInvoiceDocument('RG-3', [record({ invoiceReverseCharge: true })], company),
    )
    expect(rendered.eInvoice).toBe(false)
  })
})
