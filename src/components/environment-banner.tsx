import { isDevelopmentDatabase, isDevServerOnRemoteDatabase } from '../utils/environment'

// Always-visible strip at the top of every page outside production.
export function EnvironmentBanner() {
  if (isDevServerOnRemoteDatabase) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-[60] bg-red-600 px-4 py-2 text-center text-sm font-bold tracking-wide text-white uppercase"
      >
        Achtung: Entwicklungsserver mit der Produktionsdatenbank verbunden — alle Änderungen sind echt!
      </div>
    )
  }

  if (!isDevelopmentDatabase) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] bg-[repeating-linear-gradient(-45deg,#facc15_0_14px,#fde047_14px_28px)] px-4 py-1.5 text-center text-xs font-bold tracking-[0.15em] text-slate-900 uppercase shadow-sm"
    >
      Entwicklung · lokale Datenbank · keine echten Daten, keine echten Belege
    </div>
  )
}
