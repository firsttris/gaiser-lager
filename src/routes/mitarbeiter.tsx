import { Link, Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ClipboardPlus, History, HardHat, LogOut } from 'lucide-react'
import { PageShell } from '../components/page-shell'
import { PinEntry } from '../components/pin-pad'
import { FontScaleSwitch } from '../components/font-scale-switch'
import { Logo } from '../components/logo'
import { NavLink } from '../components/nav-link'
import { Spinner } from '../components/spinner'
import { InactivityGuard } from '../components/inactivity-guard'
import { useAppState } from '../state/app-state'
import { employeeNamesQueryOptions, employeeSessionStatusQueryOptions } from '../server/employee-auth'

export const Route = createFileRoute('/mitarbeiter')({ component: EmployeeLayout })

// An untouched driver login on the kiosk returns to the customer login.
const LOGIN_IDLE_MS = 60_000
const IDLE_RESET_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart']

function EmployeeLayout() {
  const { employee, employeeLogout, isLoggingOut, signupSettings } = useAppState()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const isLoginPage = pathname === '/mitarbeiter' || pathname === '/mitarbeiter/'

  // Session gone on a driver page: back to the customer login (kiosk rule).
  // Reads the query cache directly: right after login the cache is already
  // up to date while the context may not have re-rendered yet.
  useEffect(() => {
    const session = queryClient.getQueryData(employeeSessionStatusQueryOptions().queryKey)
    if (!session?.isLoggedIn && !isLoginPage && !isLoggingOut) window.location.assign('/')
  }, [employee, isLoginPage, isLoggingOut, queryClient])

  if (!employee) return isLoginPage ? <EmployeeLogin /> : null

  return (
    <PageShell>
      <header className="sticky top-0 z-30 -mx-4 mb-6 sm:-mt-6 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:-mx-8 sm:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo className="h-10 shrink-0" />
          <FontScaleSwitch className="header-font-switch ml-auto hidden sm:inline-flex" />
          <div>
            <div className="mb-0.5 flex items-center gap-1.5">
              <HardHat className="h-4 w-4 text-brand-600" strokeWidth={2.5} />
              <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase">Mitarbeiter</p>
            </div>
            <p className="font-title text-2xl leading-none text-slate-900">{employee.name}</p>
          </div>
        </div>
        <nav className="-mx-3 mt-2 flex flex-wrap items-center gap-1">
          <NavLink to="/mitarbeiter/neuer-vorgang" icon={<ClipboardPlus className="h-5 w-5" strokeWidth={2.25} />}>
            Neuer Vorgang
          </NavLink>
          <NavLink to="/mitarbeiter/buchungen" icon={<History className="h-5 w-5" strokeWidth={2.25} />}>
            Meine Buchungen
          </NavLink>
          <button
            type="button"
            onClick={() => void employeeLogout()}
            className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-200"
          >
            <LogOut className="h-5 w-5" strokeWidth={2.2} />
            Abmelden
          </button>
        </nav>
      </header>

      <Outlet />

      <InactivityGuard
        timeoutMinutes={signupSettings.inactivityTimeoutMinutes}
        onLogout={employeeLogout}
        isLoggingOut={isLoggingOut}
      />
    </PageShell>
  )
}

function EmployeeLogin() {
  const { employeeLogin, isEmployeeLoggingIn } = useAppState()
  const navigate = useNavigate()
  const { data: employees = [], isLoading } = useQuery(employeeNamesQueryOptions())
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let timer = setTimeout(() => void navigate({ to: '/' }), LOGIN_IDLE_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void navigate({ to: '/' }), LOGIN_IDLE_MS)
    }
    for (const eventName of IDLE_RESET_EVENTS) window.addEventListener(eventName, reset, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const eventName of IDLE_RESET_EVENTS) window.removeEventListener(eventName, reset)
    }
  }, [navigate])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void attemptLogin(pin)
  }

  // Takes the PIN as an argument: the pad calls this with the fourth digit
  // before React has re-rendered with the new state.
  async function attemptLogin(enteredPin: string) {
    if (!selected) return
    if (!/^\d{4}$/.test(enteredPin)) {
      setError('Bitte die 4-stellige PIN eingeben.')
      return
    }
    try {
      const result = await employeeLogin(selected.id, enteredPin)
      if (!result.ok) {
        setError(result.message)
        setPin('')
        return
      }
      void navigate({ to: '/mitarbeiter/neuer-vorgang' })
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
      setPin('')
    }
  }

  return (
    <PageShell>
      <section className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Logo className="h-16" />
          <h1 className="font-title text-4xl text-slate-900">Mitarbeiter-Anmeldung</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-slate-400" />
          </div>
        ) : employees.length === 0 ? (
          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-slate-700">
            Es sind noch keine Mitarbeiter angelegt (Admin → Einstellungen → Mitarbeiter).
          </p>
        ) : !selected ? (
          <>
            <p className="mt-6 text-slate-700">Bitte Namen antippen:</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {employees.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelected(entry)
                    setPin('')
                    setError('')
                  }}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-5 text-left text-xl font-semibold text-slate-900 hover:border-brand-300 hover:bg-brand-50"
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <p className="text-xl font-semibold text-slate-900">{selected.name}</p>
            <PinEntry
              label="PIN"
              value={pin}
              onChange={(next) => {
                setPin(next)
                setError('')
              }}
              onComplete={(full) => void attemptLogin(full)}
              disabled={isEmployeeLoggingIn}
              hasError={Boolean(error)}
            />
            {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl bg-slate-100 px-6 py-4 text-lg font-semibold text-slate-800 hover:bg-slate-200"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={isEmployeeLoggingIn}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEmployeeLoggingIn && <Spinner className="h-5 w-5" />}
                Anmelden
              </button>
            </div>
          </form>
        )}

        <Link to="/" className="mt-6 flex min-h-12 items-center justify-center font-semibold text-slate-700 no-underline hover:text-slate-900">
          Zurück zur Kunden-Anmeldung
        </Link>
      </section>
    </PageShell>
  )
}
