import { Delete } from 'lucide-react'

const PIN_LENGTH = 4

// On-screen number pad for the 4-digit PINs on the kiosk tablet, so nobody has
// to wait for the Android keyboard. It only edits the same value the PIN input
// holds; typing into the input keeps working.
export function PinPad({ value, onChange, disabled = false }: { value: string; onChange: (pin: string) => void; disabled?: boolean }) {
  const press = (digit: string) => {
    if (value.length < PIN_LENGTH) onChange(value + digit)
  }
  const key =
    'flex min-h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-900 tabular-nums shadow-card hover:border-slate-300 disabled:opacity-50'

  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="PIN-Tastatur">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button key={digit} type="button" className={key} disabled={disabled} onClick={() => press(digit)}>
          {digit}
        </button>
      ))}
      <button type="button" className={`${key} text-base font-medium text-slate-600`} disabled={disabled} onClick={() => onChange('')}>
        Löschen
      </button>
      <button type="button" className={key} disabled={disabled} onClick={() => press('0')}>
        0
      </button>
      <button
        type="button"
        className={`${key} text-slate-600`}
        disabled={disabled}
        onClick={() => onChange(value.slice(0, -1))}
        aria-label="Letzte Ziffer löschen"
      >
        <Delete className="h-6 w-6" strokeWidth={2} />
      </button>
    </div>
  )
}

// Four dots that fill as the PIN is entered.
export function PinDots({ length }: { length: number }) {
  return (
    <div className="flex justify-center gap-3.5 py-1" aria-hidden="true">
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <span
          key={index}
          className={`h-4 w-4 rounded-full border-2 transition duration-150 ${
            index < length ? 'scale-110 border-brand-600 bg-brand-600' : 'border-slate-300 bg-transparent'
          }`}
        />
      ))}
    </div>
  )
}
