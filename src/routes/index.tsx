import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { CompanySearchInput } from '../components/company-search-input'
import { PriceListTables } from '../components/price-list-tables'
import { publicPriceListQueryOptions } from '../server/price-list'
import { useQuery } from '@tanstack/react-query'

// Hidden way into the admin area (no visible link on the kiosk): tap the logo
// this many times within the time window.
const ADMIN_GESTURE_TAPS = 5
const ADMIN_GESTURE_WINDOW_MS = 3000

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { login, isLoggingIn, isLoggedIn } = useAppState()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const logoTapsRef = useRef<number[]>([])
  const priceListQuery = useQuery(publicPriceListQueryOptions())
  const [error, setError] = useState('')

  const navigate = Route.useNavigate()

  useEffect(() => {
    if (isLoggedIn) void navigate({ to: '/kunde/neuer-vorgang' })
  }, [isLoggedIn, navigate])

  function handleLogoTap() {
    const now = Date.now()
    logoTapsRef.current = [...logoTapsRef.current.filter((t) => now - t < ADMIN_GESTURE_WINDOW_MS), now]
    if (logoTapsRef.current.length >= ADMIN_GESTURE_TAPS) {
      logoTapsRef.current = []
      void navigate({ to: '/admin' })
    }
  }

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCompanyId) {
      setError('Bitte eine Firma auswählen.')
      return
    }

    if (pin.length !== 4) {
      setError('Bitte eine 4-stellige PIN eingeben.')
      return
    }

    try {
      const result = await login(selectedCompanyId, pin)
      if (!result.ok) {
        setError(result.message)
        return
      }

      setError('')
      void navigate({ to: '/kunde/neuer-vorgang' })
    } catch {
      setError('Firma oder PIN ist ungültig.')
    }
  }

  if (isLoggedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-slate-400" />
      </div>
    )
  }

  return (
    <PageShell>
      <TopNav />

      {/* One column at full width: the kiosk tablet is used in portrait. */}
      <section className="relative mx-auto mt-4 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-amber-100 blur-3xl"></div>
        <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sky-100 blur-3xl"></div>

        <div className="relative space-y-6 p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {/* Not a visible control on purpose: see ADMIN_GESTURE_TAPS. */}
            <div onClick={handleLogoTap} className="inline-block select-none">
              <Logo className="h-16 sm:h-20" />
            </div>
            <h1 className="font-title text-4xl leading-none text-slate-900 sm:text-5xl">Material ohne Umwege.</h1>
          </div>
          <p className="text-slate-700">Firma suchen, PIN eingeben, Vorgang anlegen, Lieferschein herunterladen.</p>

          <form onSubmit={submitLogin} className="space-y-5">
            <CompanySearchInput onSelect={(company) => setSelectedCompanyId(company?.id ?? null)} />

            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="login-pin">
                Firmen-PIN
              </label>
              <input
                id="login-pin"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="4-stellig"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg tracking-widest text-slate-900 outline-none transition focus:border-amber-500"
              />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-4 text-lg font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn && <Spinner className="h-5 w-5" />}
              Anmelden
            </button>

            <Link
              to="/registrieren"
              className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 no-underline hover:bg-slate-50"
            >
              Neu hier? Jetzt registrieren
            </Link>
          </form>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:p-10">
        <h2 className="font-title mb-6 text-4xl text-slate-900">Preisliste</h2>
        {priceListQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8 text-slate-400" />
          </div>
        ) : (
          <PriceListTables products={priceListQuery.data ?? []} />
        )}
      </section>
    </PageShell>
  )
}
