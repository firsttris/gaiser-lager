import { type ReactNode } from 'react'
import { type RecordItem } from '../state/app-state'
import { money } from '../utils/history-utils'

type Group = { id: string; items: RecordItem[] }

type Props = {
  title: string
  subtitle: string
  groups: Group[]
  variant: 'blue' | 'amber'
  showCompany?: boolean
  renderActions: (id: string, items: RecordItem[]) => ReactNode
}

const variantStyles = {
  blue: { article: 'border-blue-200', row: 'border-blue-100 bg-blue-50' },
  amber: { article: 'border-amber-200', row: 'border-amber-100 bg-amber-50' },
}

export function PendingDocumentSection({ title, subtitle, groups, variant, showCompany, renderActions }: Props) {
  const styles = variantStyles[variant]

  return (
    <article className={`rounded-2xl border ${styles.article} bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]`}>
      <h2 className="font-title text-2xl text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-4 space-y-2">
        {groups.map(({ id, items }) => {
          const total = items.reduce((sum, r) => sum + r.total, 0)
          return (
            <div key={id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border ${styles.row} px-4 py-3`}>
              <div>
                <p className="text-sm font-semibold text-slate-900">{id}</p>
                <p className="text-xs text-slate-600">
                  {showCompany && <>{items[0].company} &middot; </>}
                  {items.length} Position{items.length !== 1 ? 'en' : ''} &middot; {money(total)}
                </p>
              </div>
              <div className="flex gap-2">
                {renderActions(id, items)}
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
