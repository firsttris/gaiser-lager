import { useMemo } from 'react'
import type { RecordItem, RecordStatus } from '../state/app-state'
import { flowLabel, money, statusLabel, statusStages } from '../utils/history-utils'

interface Props {
  records: RecordItem[]
  selectedSet: Set<number>
  areAllVisibleSelected: boolean
  onSelectAll: (checked: boolean) => void
  onToggle: (id: number) => void
  showCompanyColumn?: boolean
  onStatusChange?: (id: number, status: RecordStatus) => void
  onDeliveryNoteClick?: (deliveryNoteId: string) => void
  onInvoiceClick?: (invoiceId: string) => void
  onCancelClick?: (cancelId: string) => void
}

const PALETTE = [
  { color: '#f59e0b', bg: '#fef3c7' },
  { color: '#3b82f6', bg: '#dbeafe' },
  { color: '#10b981', bg: '#d1fae5' },
  { color: '#8b5cf6', bg: '#ede9fe' },
  { color: '#f43f5e', bg: '#ffe4e6' },
  { color: '#06b6d4', bg: '#cffafe' },
  { color: '#f97316', bg: '#ffedd5' },
  { color: '#6366f1', bg: '#e0e7ff' },
]

function shortDocId(id: string) {
  const parts = id.split('-')
  if (parts.length >= 3) return `${parts[0]}-${parts[1].slice(4)}-${parts[2].slice(-4)}`
  return id
}

export function HistoryTable({
  records,
  selectedSet,
  areAllVisibleSelected,
  onSelectAll,
  onToggle,
  showCompanyColumn = false,
  onStatusChange,
  onDeliveryNoteClick,
  onInvoiceClick,
  onCancelClick,
}: Props) {
  const deliveryNoteColorMap = useMemo(() => {
    const map = new Map<string, number>()
    let index = 0
    for (const record of records) {
      if (record.deliveryNoteId && !map.has(record.deliveryNoteId)) {
        map.set(record.deliveryNoteId, index % PALETTE.length)
        index++
      }
    }
    return map
  }, [records])

  return (
    <>
      <div className="mt-4 space-y-3 md:hidden">
        {records.map((record) => {
          const palette = record.deliveryNoteId != null ? PALETTE[deliveryNoteColorMap.get(record.deliveryNoteId)!] : null
          return (
            <article
              key={record.id}
              className={`rounded-xl border border-slate-200 p-4 ${record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}`}
              style={palette ? { borderLeft: `3px solid ${palette.color}` } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{record.createdAt}</p>
                  {showCompanyColumn && (
                    <p className="mt-1 text-sm font-semibold text-slate-900">{record.company}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-700">{record.productName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {palette && (
                      <button
                        type="button"
                        onClick={() => onDeliveryNoteClick?.(record.deliveryNoteId!)}
                        style={{ color: palette.color, backgroundColor: palette.bg }}
                        className="cursor-pointer rounded px-1 py-0.5 font-mono text-xs hover:opacity-75"
                      >
                        {shortDocId(record.deliveryNoteId!)}
                      </button>
                    )}
                    {record.invoiceId && (
                      <button
                        type="button"
                        onClick={() => onInvoiceClick?.(record.invoiceId!)}
                        className="cursor-pointer rounded bg-blue-100 px-1 py-0.5 font-mono text-xs text-blue-700 hover:opacity-75"
                      >
                        {shortDocId(record.invoiceId)}
                      </button>
                    )}
                    {record.cancelId && (
                      <button
                        type="button"
                        onClick={() => onCancelClick?.(record.cancelId!)}
                        className="cursor-pointer rounded bg-red-100 px-1 py-0.5 font-mono text-xs text-red-700 hover:opacity-75"
                      >
                        {shortDocId(record.cancelId)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {flowLabel(record.type)}
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(record.id)}
                    onChange={() => onToggle(record.id)}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label={`Eintrag ${record.id} markieren`}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Menge</dt>
                  <dd className="font-semibold text-slate-800">
                    {record.amount} {record.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Einzelpreis</dt>
                  <dd className="font-semibold text-slate-800">{money(record.unitPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Gesamt</dt>
                  <dd className="font-semibold text-slate-900">{money(record.total)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-semibold text-slate-800">{statusLabel(record.status)}</dd>
                </div>
              </dl>

              <p className="mt-3 max-w-full whitespace-pre-wrap wrap-break-word text-xs text-slate-600">
                Notiz: {record.note || '-'}
              </p>

              {onStatusChange && (
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Status
                  <select
                    value={record.status}
                    onChange={(event) => onStatusChange(record.id, event.target.value as RecordStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-normal outline-none focus:border-slate-800"
                  >
                    {statusStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </article>
          )
        })}
      </div>

      <div className="mt-4 hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={areAllVisibleSelected}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label="Alle sichtbaren Eintraege markieren"
                />
              </th>
              <th className="w-28 px-2 py-2">Zeit</th>
              {showCompanyColumn && <th className="hidden w-28 px-2 py-2 lg:table-cell">Firma</th>}
              <th className="w-20 px-2 py-2">Typ</th>
              <th className="px-2 py-2">Produkt</th>
              <th className="w-16 px-2 py-2">Menge</th>
              <th className={`hidden w-28 px-2 py-2 ${showCompanyColumn ? 'xl:table-cell' : 'lg:table-cell'}`}>Preis</th>
              <th className="w-28 px-2 py-2">Gesamt</th>
              {onStatusChange ? (
                <th className="w-32 px-2 py-2">Status</th>
              ) : (
                <th className="w-24 px-2 py-2">Status</th>
              )}
              <th className={`hidden w-44 px-2 py-2 ${showCompanyColumn ? '2xl:table-cell' : 'xl:table-cell'}`}>Notiz</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const palette = record.deliveryNoteId != null ? PALETTE[deliveryNoteColorMap.get(record.deliveryNoteId)!] : null
              return (
                <tr
                  key={record.id}
                  className={`border-b border-slate-100 align-top ${record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}`}
                  style={palette ? { boxShadow: `inset 3px 0 0 ${palette.color}` } : undefined}
                >
                  <td className="px-2 pb-2 pt-2.5">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(record.id)}
                      onChange={() => onToggle(record.id)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label={`Eintrag ${record.id} markieren`}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{record.createdAt}</td>
                  {showCompanyColumn && (
                    <td className="hidden px-2 py-2 font-semibold text-slate-900 lg:table-cell">{record.company}</td>
                  )}
                  <td className="px-2 py-2">{flowLabel(record.type)}</td>
                  <td className="px-2 py-2">
                    <p className="truncate" title={record.productName}>{record.productName}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {palette && (
                        <button
                          type="button"
                          onClick={() => onDeliveryNoteClick?.(record.deliveryNoteId!)}
                          style={{ color: palette.color, backgroundColor: palette.bg }}
                          className="cursor-pointer rounded px-1 py-0.5 font-mono text-xs hover:opacity-75"
                        >
                          {shortDocId(record.deliveryNoteId!)}
                        </button>
                      )}
                      {record.invoiceId && (
                        <button
                          type="button"
                          onClick={() => onInvoiceClick?.(record.invoiceId!)}
                          className="cursor-pointer rounded bg-blue-100 px-1 py-0.5 font-mono text-xs text-blue-700 hover:opacity-75"
                        >
                          {shortDocId(record.invoiceId)}
                        </button>
                      )}
                      {record.cancelId && (
                        <button
                          type="button"
                          onClick={() => onCancelClick?.(record.cancelId!)}
                          className="cursor-pointer rounded bg-red-100 px-1 py-0.5 font-mono text-xs text-red-700 hover:opacity-75"
                        >
                          {shortDocId(record.cancelId)}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {record.amount} {record.unit}
                  </td>
                  <td className={`hidden whitespace-nowrap px-2 py-2 ${showCompanyColumn ? 'xl:table-cell' : 'lg:table-cell'}`}>
                    {money(record.unitPrice)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-900">{money(record.total)}</td>
                  {onStatusChange ? (
                    <td className="px-2 py-2">
                      <select
                        value={record.status}
                        onChange={(event) => onStatusChange(record.id, event.target.value as RecordStatus)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-slate-800"
                      >
                        {statusStages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td className="px-2 py-2 text-xs">{statusLabel(record.status)}</td>
                  )}
                  <td className={`hidden px-2 py-2 text-slate-600 ${showCompanyColumn ? '2xl:table-cell' : 'xl:table-cell'}`}>
                    <p className="line-clamp-2 whitespace-pre-wrap wrap-break-word">{record.note || '-'}</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
