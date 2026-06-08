import { money } from '../utils/history-utils'

type HistorySummaryCardsProps = {
  pickupCount: number
  dropoffCount: number
  totalAmount: number
  totalTone?: 'red' | 'green'
}

export function HistorySummaryCards({
  pickupCount,
  dropoffCount,
  totalAmount,
  totalTone = 'green',
}: HistorySummaryCardsProps) {
  const totalColorClass = totalTone === 'red' ? 'text-rose-700' : 'text-emerald-700'

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Annahme</p>
        <p className="text-sm font-semibold text-slate-900">{dropoffCount}</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Verkauf</p>
        <p className="text-sm font-semibold text-slate-900">{pickupCount}</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Summe</p>
        <p className={`text-sm font-semibold ${totalColorClass}`}>{money(totalAmount)}</p>
      </div>
    </div>
  )
}
