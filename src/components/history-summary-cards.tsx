import { money } from '../utils/history-utils'

type HistorySummaryCardsProps = {
  pickupCount: number
  dropoffCount: number
  totalRevenue: number
  totalCosts: number
}

export function HistorySummaryCards({
  pickupCount,
  dropoffCount,
  totalRevenue,
  totalCosts,
}: HistorySummaryCardsProps) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Annahme</p>
        <p className="text-lg font-semibold text-slate-900">{dropoffCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Verkauf</p>
        <p className="text-lg font-semibold text-slate-900">{pickupCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Summe Verkauf</p>
        <p className="text-lg font-semibold text-emerald-700">{money(totalRevenue)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Summe Annahme</p>
        <p className="text-lg font-semibold text-rose-700">{money(totalCosts)}</p>
      </div>
    </div>
  )
}
