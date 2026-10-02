import { SelectInput } from './select-input'

export type DatePreset = 'all' | 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom'

export interface DateRangeState {
  preset: DatePreset
  from: string
  to: string
}

export const initialDateRange: DateRangeState = { preset: 'all', from: '', to: '' }

interface Props {
  value: DateRangeState
  onChange: (value: DateRangeState) => void
}

const DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'Alle Zeiträume' },
  { value: 'this-month', label: 'Dieser Monat' },
  { value: 'last-month', label: 'Letzter Monat' },
  { value: 'last-3-months', label: 'Letzte 3 Monate' },
  { value: 'this-year', label: 'Dieses Jahr' },
  { value: 'custom', label: 'Benutzerdefiniert' },
]

export function DateRangeFilter({ value, onChange }: Props) {
  return (
    <>
      <label className="text-sm font-semibold text-slate-700">
        Zeitraum
        <SelectInput
          value={value.preset}
          onChange={(preset) => onChange({ preset: preset as DatePreset, from: '', to: '' })}
          options={DATE_PRESET_OPTIONS}
          className="mt-2 w-full min-h-12 px-3 py-2 font-normal"
        />
      </label>
      {value.preset === 'custom' && (
        <>
          <label className="text-sm font-semibold text-slate-700">
            Von
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="mt-2 w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Bis
            <input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="mt-2 w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
        </>
      )}
    </>
  )
}

// Calendar date as the user sees it. (toISOString() would convert local
// midnight to UTC first, which in Germany yields the previous day.)
function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Resolves a preset into concrete ISO date boundaries for the server-side
// created_at filter. Mirrors the semantics of the old client-side
// matchesDateRange: this-month/last-month/this-year are whole-month/year
// windows, last-3-months is an open-ended lower bound, custom passes the
// raw <input type=date> values through.
export function resolveDateRange(state: DateRangeState): { from?: string; to?: string } {
  const now = new Date()

  if (state.preset === 'this-month') {
    return {
      from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }

  if (state.preset === 'last-month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return {
      from: toISODate(lastMonth),
      to: toISODate(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)),
    }
  }

  if (state.preset === 'last-3-months') {
    return { from: toISODate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())) }
  }

  if (state.preset === 'this-year') {
    return {
      from: toISODate(new Date(now.getFullYear(), 0, 1)),
      to: toISODate(new Date(now.getFullYear(), 11, 31)),
    }
  }

  if (state.preset === 'custom') {
    return { from: state.from || undefined, to: state.to || undefined }
  }

  return {}
}
