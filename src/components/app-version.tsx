import { formatBerlinDateTime } from '../utils/berlin-time'

// Which version a device runs (e.g. the kiosk tablet), to compare with the
// latest deployment: short git commit + build time.
function environmentLabel() {
  if (import.meta.env.DEV) return 'Entwicklung'
  if (__APP_BUILD_ENV__ === 'production') return 'Produktion'
  if (__APP_BUILD_ENV__ === 'preview') return 'Vorschau'
  return 'Lokaler Build'
}

export function AppVersion() {
  const builtAt = formatBerlinDateTime(__APP_BUILD_TIME__).replace(/:\d{2}$/, '')
  return (
    <p className="mt-10 text-center text-xs text-slate-600">
      {environmentLabel()}
      {!import.meta.env.DEV && ` · Version ${__APP_BUILD_COMMIT__ || 'lokal'}`} · Stand {builtAt}
    </p>
  )
}
