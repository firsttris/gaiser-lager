import { Delete } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_INTEGER_DIGITS = 5
const MAX_DECIMALS = 2

// Amounts are kept as a plain string with a dot ("12.5") so Number() parses
// them; the kiosk shows them the German way.
export function formatAmount(amount: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: MAX_DECIMALS }).format(amount)
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

// Number pad for an amount on the kiosk tablet, so the Android keyboard never
// has to open: digits, comma, backspace, big readout. A physical keyboard
// works too (digits, comma or dot, Backspace, Enter, Escape).
export function AmountPadDialog({
  open,
  unit,
  initialValue,
  onClose,
  onApply,
}: {
  open: boolean
  unit: string
  /** Current amount in internal form ("12.5"), or '' for none. */
  initialValue: string
  onClose: () => void
  onApply: (amount: string) => void
}) {
  const [draft, setDraft] = useState(initialValue)
  // The current amount is shown when the dialog opens, but like a calculator
  // the first digit or comma replaces it instead of being appended.
  const [isFresh, setIsFresh] = useState(true)

  useEffect(() => {
    if (open) {
      setDraft(initialValue)
      setIsFresh(true)
    }
  }, [open, initialValue])

  const parsed = Number(draft)
  const isValid = draft !== '' && Number.isFinite(parsed) && parsed > 0

  const pressDigit = (digit: string) => {
    setIsFresh(false)
    setDraft((previous) => {
      const current = isFresh ? '' : previous
      const [integerPart, decimalPart] = current.split('.')
      if (decimalPart !== undefined) return decimalPart.length >= MAX_DECIMALS ? current : current + digit
      if (integerPart === '0') return digit
      return integerPart.length >= MAX_INTEGER_DIGITS ? current : current + digit
    })
  }
  const pressComma = () => {
    setIsFresh(false)
    setDraft((previous) => {
      const current = isFresh ? '' : previous
      return current.includes('.') ? current : current === '' ? '0.' : current + '.'
    })
  }
  const erase = () => {
    setIsFresh(false)
    setDraft((current) => current.slice(0, -1))
  }
  const clear = () => {
    setIsFresh(false)
    setDraft('')
  }
  const apply = () => {
    if (isValid) onApply(draft.replace(/\.$/, ''))
  }

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (/^[0-9]$/.test(event.key)) pressDigit(event.key)
      else if (event.key === ',' || event.key === '.') pressComma()
      else if (event.key === 'Backspace') erase()
      else if (event.key === 'Enter') apply()
      else if (event.key === 'Escape') onClose()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (!open) return null

  const key =
    'flex min-h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-900 tabular-nums shadow-card hover:border-slate-300 disabled:opacity-50'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Menge in ${unit} eingeben`} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-title text-2xl text-slate-900">Menge ({unit})</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Abbrechen
          </button>
        </div>

        <p
          className={`mt-4 flex min-h-20 items-baseline justify-end gap-2 rounded-xl border px-4 py-3 ${
            draft ? 'border-slate-300 bg-slate-50' : 'border-dashed border-slate-300 bg-slate-50'
          }`}
          aria-live="polite"
        >
          <span className={`text-5xl font-semibold tabular-nums ${draft ? 'text-slate-900' : 'text-slate-400'}`}>
            {draft ? draft.replace('.', ',') : '0'}
          </span>
          <span className="text-xl font-semibold text-slate-600">{unit}</span>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button key={digit} type="button" className={key} onClick={() => pressDigit(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" className={key} onClick={pressComma} disabled={!isFresh && draft.includes('.')} aria-label="Komma">
            ,
          </button>
          <button type="button" className={key} onClick={() => pressDigit('0')}>
            0
          </button>
          <button
            type="button"
            className={`${key} text-slate-600`}
            onClick={erase}
            disabled={draft.length === 0}
            aria-label="Letzte Ziffer löschen"
          >
            <Delete className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={clear}
            disabled={draft.length === 0}
            className="min-h-16 rounded-xl bg-slate-100 text-base font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-50"
          >
            Löschen
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!isValid}
            className="col-span-2 min-h-16 rounded-xl bg-brand-600 text-lg font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
