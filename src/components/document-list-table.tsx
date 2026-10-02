import type { ReactNode } from 'react'
import type { RecordItem } from '../state/app-state'
import { money } from '../utils/history-utils'

export type DocumentGroup = { id: string; items: RecordItem[] }
export type BadgeConfig = { label: string; className: string }

interface Props {
  groups: DocumentGroup[]
  showCompanyColumn?: boolean
  showTotalColumn?: boolean
  getBadge: (items: RecordItem[]) => BadgeConfig
  getExtraBadges?: (items: RecordItem[]) => BadgeConfig[]
  renderDateien: (id: string, items: RecordItem[]) => ReactNode
  renderActions?: (id: string, items: RecordItem[]) => ReactNode
  selectedIds?: Set<string>
  onSelectionChange?: (group: DocumentGroup, checked: boolean) => void
  isSelectable?: (items: RecordItem[]) => boolean
  areAllSelected?: boolean
  onSelectAll?: (checked: boolean) => void
}

export function DocumentListTable({
  groups,
  showCompanyColumn,
  showTotalColumn = true,
  getBadge,
  getExtraBadges,
  renderDateien,
  renderActions,
  selectedIds,
  onSelectionChange,
  isSelectable,
  areAllSelected,
  onSelectAll,
}: Props) {
  const selectable = selectedIds !== undefined && onSelectionChange !== undefined
  return (
    // Cards or table depending on the space the list actually has (container
    // query), see HistoryTable.
    <div className="@container">
      <div className="mt-4 space-y-3 @min-[44rem]:hidden">
        {groups.map(({ id, items }) => {
          const total = items.reduce((sum, r) => sum + r.total, 0)
          const badge = getBadge(items)
          const rowSelectable = selectable && (isSelectable?.(items) ?? true)
          return (
            <article key={id} className={`rounded-xl border p-4 ${selectedIds?.has(id) ? 'border-brand-300 bg-brand-50' : badge.label === 'Storniert' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {selectable && (
                    <label className="-m-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds!.has(id)}
                        disabled={!rowSelectable}
                        onChange={(e) => onSelectionChange!({ id, items }, e.target.checked)}
                        className="h-7 w-7 cursor-pointer shrink-0 rounded border-slate-300 disabled:opacity-40"
                      />
                    </label>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-slate-900">{id}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{items[0].createdAt.split(', ')[0]}</p>
                    <p className="text-xs text-slate-600">{items[0].createdAt.split(', ')[1]}</p>
                    {showCompanyColumn && (
                      <p className="mt-1 text-sm font-semibold text-slate-900">{items[0].company}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <span className={`pill ${badge.className}`}>
                    {badge.label}
                  </span>
                  {getExtraBadges?.(items).map((b) => (
                    <span key={b.label} className={`pill ${b.className}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-600">Positionen</dt>
                  <dd className="font-semibold text-slate-800">{items.length}</dd>
                </div>
                {showTotalColumn && (
                  <div>
                    <dt className="text-slate-600">Gesamt</dt>
                    <dd className="font-semibold text-slate-900">{money(total)}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {renderDateien(id, items)}
              </div>
              {renderActions && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {renderActions(id, items)}
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="mt-4 hidden @min-[44rem]:block">
        <table className="data-table table-fixed">
          <thead>
            <tr>
              {selectable && (
                <th className="w-12">
                  {onSelectAll && (
                    <label className="-m-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                      <input
                        type="checkbox"
                        checked={areAllSelected ?? false}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        className="h-7 w-7 cursor-pointer rounded border-slate-300"
                        aria-label="Alle sichtbaren Einträge markieren"
                      />
                    </label>
                  )}
                </th>
              )}
              <th className="w-44">Nummer / Datum</th>
              {showCompanyColumn && <th>Firma</th>}
              <th className="num w-28">{showTotalColumn ? 'Gesamt' : 'Positionen'}</th>
              <th className="w-28">Status</th>
              <th className="w-36">Dateien</th>
              {renderActions && <th className="w-40">Aktionen</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ id, items }) => {
              const total = items.reduce((sum, r) => sum + r.total, 0)
              const badge = getBadge(items)
              const rowSelectable = selectable && (isSelectable?.(items) ?? true)
              const [date, time] = items[0].createdAt.split(', ')
              return (
                <tr key={id} className={selectedIds?.has(id) ? 'bg-brand-50' : badge.label === 'Storniert' ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50'}>
                  {selectable && (
                    <td>
                      <label className="cell-check -mx-2.5 -mb-2.5 inline-flex shrink-0 cursor-pointer p-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds!.has(id)}
                          disabled={!rowSelectable}
                          onChange={(e) => onSelectionChange!({ id, items }, e.target.checked)}
                          className="h-7 w-7 cursor-pointer rounded border-slate-300 disabled:opacity-40"
                        />
                      </label>
                    </td>
                  )}
                  <td>
                    <span className="font-mono whitespace-nowrap">{id}</span>
                    <span className="cell-secondary">
                      {date}, {time}
                    </span>
                  </td>
                  {showCompanyColumn && <td className="cell-primary wrap-break-word">{items[0].company}</td>}
                  <td className="num">
                    {showTotalColumn ? money(total) : items.length}
                    {showTotalColumn && (
                      <span className="cell-secondary">
                        {items.length} {items.length === 1 ? 'Position' : 'Positionen'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="cell-badge flex flex-wrap gap-1">
                      <span className={`pill ${badge.className}`}>{badge.label}</span>
                      {getExtraBadges?.(items).map((b) => (
                        <span key={b.label} className={`pill ${b.className}`}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{renderDateien(id, items)}</td>
                  {renderActions && (
                    <td>
                      <div className="cell-trigger flex flex-wrap gap-2">{renderActions(id, items)}</div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
