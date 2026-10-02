import type { RecordItem, RecordStatus } from '../state/app-state'
import { flowLabel, money, quantity, statusBadge, statusStages } from '../utils/history-utils'
import { Camera } from 'lucide-react'
import { FileList, type FileEntry } from './file-list'
import { SelectInput } from './select-input'

interface Props {
  records: RecordItem[]
  selectedSet: Set<number>
  areAllVisibleSelected: boolean
  onSelectAll: (checked: boolean) => void
  onToggle: (record: RecordItem) => void
  showCompanyColumn?: boolean
  onStatusChange?: (id: number, status: RecordStatus) => void
  onDeliveryNoteClick?: (deliveryNoteId: string) => void
  onInvoiceClick?: (invoiceId: string) => void
  onCancelClick?: (cancelId: string) => void
  downloadingDocId?: string | null
  /** Shows a "Fotos" button for Vorgänge with delivery note photos. */
  onPhotosClick?: (record: RecordItem) => void
  /** false hides the checkboxes (e.g. the drivers' own booking list). */
  selectable?: boolean
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
  downloadingDocId = null,
  onPhotosClick,
  selectable = true,
}: Props) {
  function recordFiles(record: RecordItem): FileEntry[] {
    const files: FileEntry[] = []
    if (record.deliveryNoteId) {
      const id = record.deliveryNoteId
      files.push({ key: id, label: id, kind: 'Lieferschein', color: 'amber', onClick: () => onDeliveryNoteClick?.(id), loading: downloadingDocId === id })
    }
    if (record.invoiceId) {
      const id = record.invoiceId
      files.push({ key: id, label: id, kind: 'Rechnung', color: 'blue', onClick: () => onInvoiceClick?.(id), loading: downloadingDocId === id })
    }
    if (record.cancelId) {
      const id = record.cancelId
      files.push({ key: id, label: id, kind: 'Storno', color: 'red', onClick: () => onCancelClick?.(id), loading: downloadingDocId === id })
    }
    if (onPhotosClick && record.photoCount) {
      files.push({
        key: 'photos',
        label: `${record.photoCount} ${record.photoCount === 1 ? 'Foto' : 'Fotos'}`,
        kind: 'Lieferschein-Fotos',
        color: 'emerald',
        icon: <Camera className="h-4 w-4" strokeWidth={2.25} />,
        count: record.photoCount,
        onClick: () => onPhotosClick(record),
      })
    }
    return files
  }

  return (
    // Cards or table depending on the space the list actually has (container
    // query), not the screen width: with the larger kiosk font the table needs
    // more room than the same screen offers.
    <div className="@container">
      <div className="mt-4 space-y-3 @4xl:hidden">
        {records.map((record) => {
          return (
            <article
              key={record.id}
              className={`rounded-xl border border-slate-200 p-4 ${record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="block text-slate-600">{record.createdAt.split(', ')[0]}</span>
                    <span className="block text-slate-600">{record.createdAt.split(', ')[1]}</span>
                  </p>
                  {showCompanyColumn && (
                    <p className="mt-1 text-sm font-semibold text-slate-900">{record.company}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-700">{record.productName}</p>
                  <p className="mt-1 text-xs text-slate-600">Baustelle: {record.constructionSiteName || '-'}</p>
                  {record.createdByName && (
                    <p className="mt-1 text-xs text-slate-600">Gebucht von: {record.createdByName}</p>
                  )}
                  <div className="mt-2">
                    <FileList files={recordFiles(record)} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {flowLabel(record.type)}
                  </span>
                  {selectable && (
                    <label className="-m-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(record.id)}
                        onChange={() => onToggle(record)}
                        className="h-7 w-7 cursor-pointer rounded border-slate-300"
                        aria-label={`Eintrag ${record.id} markieren`}
                      />
                    </label>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-600">Menge</dt>
                  <dd className="font-semibold text-slate-800">
                    {quantity(record.amount)} {record.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Einzelpreis</dt>
                  <dd className="font-semibold text-slate-800">{money(record.unitPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`pill ${statusBadge(record.status).className}`}>
                      {statusBadge(record.status).label}
                    </span>
                  </dd>
                </div>
              </dl>
              {onStatusChange && (
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Status
                  <SelectInput
                    value={record.status}
                    onChange={(status) => onStatusChange(record.id, status as RecordStatus)}
                    options={statusStages}
                    className="mt-1 w-full min-h-10 px-2 py-1 text-sm font-normal"
                    label="Status"
                  />
                </label>
              )}
            </article>
          )
        })}
      </div>

      <div className="mt-4 hidden @4xl:block">
        <table className="data-table table-fixed">
          <thead>
            <tr>
              {selectable && (
                <th className="w-12">
                  <label className="-m-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                    <input
                      type="checkbox"
                      checked={areAllVisibleSelected}
                      onChange={(event) => onSelectAll(event.target.checked)}
                      className="h-7 w-7 cursor-pointer rounded border-slate-300"
                      aria-label="Alle sichtbaren Einträge markieren"
                    />
                  </label>
                </th>
              )}
              <th className="w-28">Datum</th>
              <th className="w-32">Typ</th>
              <th>{showCompanyColumn ? 'Firma / Baustelle' : 'Baustelle'}</th>
              <th>Produkt</th>
              <th className="num w-24">Menge</th>
              <th className={onStatusChange ? 'w-36' : 'w-32'}>Status</th>
              <th className="w-44">Dateien</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const [date, time] = record.createdAt.split(', ')
              const badge = statusBadge(record.status)
              return (
                <tr
                  key={record.id}
                  className={record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}
                >
                  {selectable && (
                    <td>
                      <label className="cell-check -mx-2.5 -mb-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(record.id)}
                          onChange={() => onToggle(record)}
                          className="h-7 w-7 cursor-pointer rounded border-slate-300"
                          aria-label={`Eintrag ${record.id} markieren`}
                        />
                      </label>
                    </td>
                  )}
                  <td>
                    {date}
                    <span className="cell-secondary">{time}</span>
                  </td>
                  <td className="wrap-break-word">
                    {flowLabel(record.type)}
                    {record.createdByName && (
                      <span className="cell-secondary" title="Gebucht von">
                        {record.createdByName}
                      </span>
                    )}
                  </td>
                  <td className="wrap-break-word">
                    {showCompanyColumn ? (
                      <>
                        <span className="cell-primary">{record.company}</span>
                        <span className="cell-secondary line-clamp-2">{record.constructionSiteName || '—'}</span>
                      </>
                    ) : (
                      <span className="line-clamp-2">{record.constructionSiteName || '—'}</span>
                    )}
                  </td>
                  <td>
                    <span className="line-clamp-2 wrap-break-word" title={record.productName}>
                      {record.productName}
                    </span>
                  </td>
                  <td className="num">
                    {quantity(record.amount)} {record.unit}
                  </td>
                  {onStatusChange ? (
                    <td>
                      <div className="cell-trigger">
                        <SelectInput
                          value={record.status}
                          onChange={(status) => onStatusChange(record.id, status as RecordStatus)}
                          options={statusStages}
                          className="w-full min-h-11 px-2 py-1 text-sm font-normal"
                          label="Status"
                        />
                      </div>
                    </td>
                  ) : (
                    <td>
                      <span className={`pill cell-badge ${badge.className}`}>{badge.label}</span>
                    </td>
                  )}
                  <td>
                    <FileList files={recordFiles(record)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

