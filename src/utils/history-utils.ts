import type { RecordItem, RecordStatus, RecordType } from '../state/app-state'

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

// Amounts in German notation (12,5 t), as on the PDFs.
export function quantity(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}

export function flowLabel(type: RecordType) {
  if (type === 'lkw') return 'LKW'
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  offen:        { label: 'Offen',        className: 'bg-slate-100 text-slate-600' },
  lieferschein: { label: 'Lieferschein', className: 'bg-amber-100 text-amber-800' },
  rechnung:     { label: 'Rechnung',     className: 'bg-blue-100 text-blue-800' },
  bezahlt:      { label: 'Bezahlt',      className: 'bg-emerald-100 text-emerald-800' },
  storniert:    { label: 'Storniert',    className: 'bg-slate-100 text-slate-600' },
}

export function statusBadge(status: RecordStatus | string) {
  return STATUS_BADGE[status] ?? { label: statusLabel(status), className: 'bg-slate-100 text-slate-600' }
}

export function deliveryNoteBadge(items: RecordItem[]) {
  const statuses = new Set(items.map((r) => r.status))
  if (statuses.size === 1 && statuses.has('storniert')) return statusBadge('storniert')
  if (statuses.has('bezahlt')) return statusBadge('bezahlt')
  if (statuses.has('rechnung')) return statusBadge('rechnung')
  return statusBadge('lieferschein')
}

export function invoiceBadge(items: RecordItem[]) {
  const statuses = new Set(items.map((r) => r.status))
  if (statuses.size === 1 && statuses.has('storniert')) return statusBadge('storniert')
  if (statuses.has('bezahlt')) return statusBadge('bezahlt')
  return statusBadge('rechnung')
}

export type DeliveryNoteStatusFilter = 'all' | 'offen' | 'berechnet' | 'storniert'

export function deliveryNoteStatusFilterOf(items: RecordItem[]): DeliveryNoteStatusFilter {
  const badge = deliveryNoteBadge(items)
  if (badge.label === 'Storniert') return 'storniert'
  if (badge.label === 'Rechnung' || badge.label === 'Bezahlt') return 'berechnet'
  return 'offen'
}

export function reverseChargeExtraBadges(items: RecordItem[]) {
  return items[0].invoiceReverseCharge ? [{ label: '§13b UStG', className: 'bg-purple-100 text-purple-700' }] : []
}

export function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""')
  return `"${text}"`
}

export function companyFilenameSegment(companyName?: string) {
  return (
    companyName
      ?.toLocaleLowerCase('de-DE')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'kunde'
  )
}

export function downloadCsvFile(filename: string, content: string) {
  downloadTextFile(filename, content, 'text/csv;charset=utf-8;')
}

export function downloadSqlFile(filename: string, content: string) {
  downloadTextFile(filename, content, 'application/sql;charset=utf-8;')
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
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
    'Baustelle',
    'Produkt',
    'Menge',
    'Einheit',
    'Einzelpreis EUR',
    'Gesamt EUR',
    'Status',
  ]

  const header = includeCompany
    ? [baseHeader[0], 'Firma', ...baseHeader.slice(1)]
    : baseHeader

  const rows = records.map((record) => {
    const baseRow: Array<string | number> = [
      record.createdAt,
      flowLabel(record.type),
      record.constructionSiteName || '-',
      record.productName,
      record.amount,
      record.unit,
      record.unitPrice,
      record.total,
      statusLabel(record.status),
    ]

    return includeCompany
      ? [baseRow[0], record.company, ...baseRow.slice(1)]
      : baseRow
  })

  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(';'))
    .join('\n')
}
