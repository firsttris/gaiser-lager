import { useEffect, type ReactNode } from 'react'
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
  default: 'bg-white/10 text-white ring-1 ring-white/25 ring-inset hover:bg-white/20',
  primary: 'bg-white text-slate-900 hover:bg-brand-50',
} as const

// Appears only while something is selected, docked to the bottom of the
// screen where a hand on the kiosk tablet reaches it; it stays visible while
// scrolling the list. Extra bottom padding on the page keeps it from covering
// the last rows (see body.has-selection-bar in styles.css).
export function SelectionActionBar({ count, noun, pluralLabel, total, warning, onClear, actions }: Props) {
  const isVisible = count > 0
  const label = count === 1 ? noun : pluralLabel

  useEffect(() => {
    document.body.classList.toggle('has-selection-bar', isVisible)
    return () => document.body.classList.remove('has-selection-bar')
  }, [isVisible])

  return (
    <>
      <div
        aria-hidden={!isVisible}
        className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition duration-200 ease-out sm:px-6 sm:pb-5 ${
          isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
        }`}
      >
        <div
          role="region"
          aria-label="Auswahl"
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-[0_18px_40px_rgba(15,23,42,0.35)] sm:px-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-bold text-slate-900">
              {count}
            </span>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">{label}</span> ausgewählt
              <span className="mx-2 text-slate-500">·</span>
              <span className="font-semibold text-white tabular-nums">{money(total)}</span>
            </p>
            <button
              type="button"
              disabled={!isVisible}
              onClick={onClear}
              aria-label="Auswahl aufheben"
              title="Auswahl aufheben"
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
              Aufheben
            </button>
            {warning && (
              <span className="rounded-lg bg-amber-400/20 px-2 py-1 text-xs font-semibold text-amber-200">{warning}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={!isVisible || action.disabled}
                onClick={action.onClick}
                className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[action.variant ?? 'default']}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
