import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { money } from '../utils/history-utils'

type ActionButton = {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary'
  icon?: ReactNode
}

interface Props {
  count: number
  noun: string
  pluralLabel: string
  total: number
  warning?: string
  onClear: () => void
  actions: ActionButton[]
}

const VARIANT_CLASSES = {
  default: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  primary: 'bg-slate-900 text-white hover:bg-black',
} as const

export function SelectionActionBar({ count, noun, pluralLabel, total, warning, onClear, actions }: Props) {
  const isVisible = count > 0
  const label = count === 1 ? noun : pluralLabel

  return (
    <div
      aria-hidden={!isVisible}
      className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${
        isVisible ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-bold text-white">
              {count}
            </span>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{label}</span> ausgewählt
              <span className="mx-2 text-slate-300">·</span>
              <span className="font-semibold text-slate-900">{money(total)}</span>
            </p>
            {warning && (
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{warning}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={!isVisible || action.disabled}
                onClick={action.onClick}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[action.variant ?? 'default']}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <button
              type="button"
              disabled={!isVisible}
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              Aufheben
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
