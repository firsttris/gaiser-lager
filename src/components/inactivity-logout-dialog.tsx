import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  secondsRemaining: number
  totalSeconds: number
  isLoggingOut: boolean
  onContinueSession: () => void
  onLogoutNow: () => void
}

export function InactivityLogoutDialog({
  open,
  secondsRemaining,
  totalSeconds,
  isLoggingOut,
  onContinueSession,
  onLogoutNow,
}: Props) {
  if (!open) return null

  const safeTotal = Math.max(totalSeconds, 1)
  const progress = Math.max(0, Math.min(1, secondsRemaining / safeTotal))
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Inaktivitaet erkannt</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">Noch da?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Sie werden in <span className="font-semibold text-slate-900">{secondsRemaining} Sekunden</span> automatisch
          abgemeldet.
        </p>

        <div className="mt-5 flex justify-center">
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r={radius} className="fill-none stroke-slate-200" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="fill-none stroke-amber-500 transition-[stroke-dashoffset] duration-200"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{secondsRemaining}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onContinueSession}
            disabled={isLoggingOut}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Angemeldet bleiben
          </button>
          <button
            type="button"
            onClick={onLogoutNow}
            disabled={isLoggingOut}
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Jetzt abmelden
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
