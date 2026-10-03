import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { PinEntry } from '../components/pin-pad'
import { HardHat } from 'lucide-react'
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

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void attemptLogin(pin)
  }

  // Takes the PIN as an argument: the pad calls this with the fourth digit
  // before React has re-rendered with the new state.
  async function attemptLogin(enteredPin: string) {
    if (!selectedCompanyId) {
      setError('Bitte eine Firma auswählen.')
      return
    }

    if (enteredPin.length !== 4) {
      setError('Bitte eine 4-stellige PIN eingeben.')
      return
    }

    try {
      const result = await login(selectedCompanyId, enteredPin)
      if (!result.ok) {
        setError(result.message)
        setPin('')
        return
      }

      setError('')
      void navigate({ to: '/kunde/neuer-vorgang' })
    } catch {
      setError('Firma oder PIN ist ungültig.')
      setPin('')
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

      {/* Tablet: two halves, who we are and where else to go on the left, the
          login with its PIN pad on the right. Phone: one column with the login
          right below the heading and the other ways in after it (that is also
          the order in the markup). The price list stays below. */}
      <section className="mx-auto mt-4 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-2 md:grid-rows-[1fr_auto]">
        <div className="flex flex-col gap-6 p-6 sm:p-10 md:col-start-1 md:row-start-1 md:border-r md:border-slate-200">
          {/* Not a visible control on purpose: see ADMIN_GESTURE_TAPS. */}
          <div onClick={handleLogoTap} className="inline-block select-none self-start">
            <Logo className="h-16 sm:h-20" />
          </div>
          <div className="space-y-3">
            <h1 className="font-title text-4xl text-slate-900">Material ohne Umwege.</h1>
            <p className="text-lg text-slate-600">Firma suchen, PIN eingeben, Vorgang anlegen, Lieferschein herunterladen.</p>
          </div>
        </div>

        <form onSubmit={submitLogin} className="space-y-5 bg-slate-50 p-6 sm:p-10 md:col-start-2 md:row-span-2 md:row-start-1">
          <CompanySearchInput onSelect={(company) => setSelectedCompanyId(company?.id ?? null)} />

          <PinEntry
            label="Firmen-PIN"
            value={pin}
            onChange={(next) => {
              setPin(next)
              setError('')
            }}
            onComplete={(full) => void attemptLogin(full)}
            disabled={isLoggingIn}
            hasError={Boolean(error)}
          />

          {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-lg font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingIn && <Spinner className="h-5 w-5" />}
            Anmelden
          </button>
        </form>

        <div className="grid gap-3 p-6 sm:p-10 md:col-start-1 md:row-start-2 md:border-r md:border-slate-200 md:pt-0">
          <Link
            to="/mitarbeiter"
            className="flex min-h-16 items-center justify-center gap-3 rounded-xl border-2 border-brand-600 bg-white px-5 text-lg font-semibold text-brand-700 no-underline hover:bg-brand-50"
          >
            <HardHat className="h-6 w-6" strokeWidth={2.25} />
            Mitarbeiter-Anmeldung (Fahrer)
          </Link>
          <Link
            to="/registrieren"
            className="flex min-h-14 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 no-underline hover:bg-slate-50"
          >
            Neu hier? Jetzt registrieren
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
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
