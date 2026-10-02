import { Delete } from 'lucide-react'
import { useEffect, useId } from 'react'

export const PIN_LENGTH = 4

// Full PIN entry for the kiosk tablet: four dots plus an on-screen number pad,
// deliberately without a text input so the Android keyboard never opens and
// pushes the page around. A physical keyboard still works (digits, Backspace)
// as long as no other field has focus. `onComplete` fires with the whole PIN as
// soon as the fourth digit lands, so nobody has to hunt for a submit button.
export function PinEntry({
  label,
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
}: {
  label: string
  value: string
  onChange: (pin: string) => void
  onComplete?: (pin: string) => void
  disabled?: boolean
  hasError?: boolean
}) {
  const labelId = useId()

  const press = (digit: string) => {
    if (disabled || value.length >= PIN_LENGTH) return
    const next = value + digit
    onChange(next)
    if (next.length === PIN_LENGTH) onComplete?.(next)
  }
  const erase = () => {
    if (!disabled && value.length > 0) onChange(value.slice(0, -1))
  }

  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        press(event.key)
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        erase()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const key =
    'flex min-h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-900 tabular-nums shadow-card hover:border-slate-300 disabled:opacity-50'

  return (
    <div className="space-y-4">
      <p id={labelId} className="text-sm font-semibold text-slate-700">
        {label}
      </p>
      <PinDots length={value.length} hasError={hasError} />
      <p className="sr-only" aria-live="polite">
        {value.length} von {PIN_LENGTH} Ziffern eingegeben
      </p>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-labelledby={labelId}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} type="button" className={key} disabled={disabled} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={`${key} text-base font-medium text-slate-600`}
          disabled={disabled || value.length === 0}
          onClick={() => onChange('')}
        >
          Löschen
        </button>
        <button type="button" className={key} disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className={`${key} text-slate-600`}
          disabled={disabled || value.length === 0}
          onClick={erase}
          aria-label="Letzte Ziffer löschen"
        >
          <Delete className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// Keys typed into another field (e.g. the company search) belong to that field.
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

// Four dots that fill as the PIN is entered; red rings after a rejected PIN.
export function PinDots({ length, hasError = false }: { length: number; hasError?: boolean }) {
  const empty = hasError ? 'border-red-400 bg-transparent' : 'border-slate-300 bg-transparent'
  return (
    <div className="flex justify-center gap-4 py-3" aria-hidden="true">
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <span
          key={index}
          className={`h-4 w-4 rounded-full border-2 transition duration-150 ${
            index < length ? 'scale-110 border-brand-600 bg-brand-600' : empty
          }`}
        />
      ))}
    </div>
  )
}
