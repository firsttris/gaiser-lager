import type { FlowType, RecordItem, RecordStatus } from '../state/app-state'

export function groupByDocId(
  records: RecordItem[],
  status: RecordStatus,
  idField: 'deliveryNoteId' | 'invoiceId',
): Array<{ id: string; items: RecordItem[] }> {
  const byId = new Map<string, RecordItem[]>()
  for (const record of records) {
    const id = record[idField]
    if (record.status === status && id) {
      const group = byId.get(id) ?? []
      group.push(record)
      byId.set(id, group)
    }
  }
  return Array.from(byId.entries())
    .map(([id, items]) => ({ id, items }))
    .sort((a, b) => b.id.localeCompare(a.id))
}

export function money(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function flowLabel(type: FlowType) {
  return type === 'pickup' ? 'Verkauf' : 'Annahme'
}

export const statusStages: Array<{ value: RecordStatus; label: string }> = [
  { value: 'offen', label: 'Offen' },
  { value: 'lieferschein', label: 'Lieferschein' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'bezahlt', label: 'Bezahlt' },
  { value: 'storniert', label: 'Storniert' },
]

export function statusLabel(status: RecordStatus | string) {
  return statusStages.find((stage) => stage.value === status)?.label ?? status
}

export function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""')
  return `"${text}"`
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function createHistoryCsv(records: RecordItem[], includeCompany: boolean) {
  const baseHeader = [
    'Zeit',
    'Typ',
    'Produkt',
    'Menge',
    'Einheit',
    'Einzelpreis EUR',
    'Gesamt EUR',
    'Status',
    'Notiz',
  ]

  const header = includeCompany
    ? [baseHeader[0], 'Firma', ...baseHeader.slice(1)]
    : baseHeader

  const rows = records.map((record) => {
    const baseRow: Array<string | number> = [
      record.createdAt,
      flowLabel(record.type),
      record.productName,
      record.amount,
      record.unit,
      record.unitPrice,
      record.total,
      statusLabel(record.status),
      record.note || '-',
    ]

    return includeCompany
      ? [baseRow[0], record.company, ...baseRow.slice(1)]
      : baseRow
  })

  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(';'))
    .join('\n')
}
