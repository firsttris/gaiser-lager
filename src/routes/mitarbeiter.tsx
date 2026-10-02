import { Link, Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Camera, ClipboardPlus, History, HardHat, LogOut } from 'lucide-react'
import { PageShell } from '../components/page-shell'
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
      <header className="mb-8 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Logo className="h-12 shrink-0 sm:h-16" />
          <div>
            <div className="mb-0.5 flex items-center gap-1.5">
              <HardHat className="h-4 w-4 text-amber-700" strokeWidth={2.5} />
              <p className="text-sm font-semibold tracking-wider text-amber-800 uppercase">Mitarbeiter</p>
            </div>
            <p className="font-title text-3xl leading-none text-slate-900">{employee.name}</p>
          </div>
        </div>
        <nav className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-4">
          <NavLink to="/mitarbeiter/neuer-vorgang" icon={<ClipboardPlus className="h-5 w-5" strokeWidth={2.25} />}>
            Neuer Vorgang
          </NavLink>
          <NavLink to="/mitarbeiter/lieferscheine" icon={<Camera className="h-5 w-5" strokeWidth={2.25} />}>
            Lieferscheine fotografieren
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    if (!/^\d{4}$/.test(pin)) {
      setError('Bitte die 4-stellige PIN eingeben.')
      return
    }
    try {
      const result = await employeeLogin(selected.id, pin)
      if (!result.ok) {
        setError(result.message)
        setPin('')
        return
      }
      void navigate({ to: '/mitarbeiter/neuer-vorgang' })
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
    }
  }

  return (
    <PageShell>
      <section className="mx-auto mt-4 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Logo className="h-16" />
          <h1 className="font-title text-4xl leading-none text-slate-900">Mitarbeiter-Anmeldung</h1>
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
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-5 text-left text-xl font-semibold text-slate-900 hover:border-amber-400 hover:bg-amber-50"
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <p className="text-xl font-semibold text-slate-900">{selected.name}</p>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="employee-pin">
                PIN
              </label>
              <input
                id="employee-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="4-stellig"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg tracking-widest outline-none focus:border-amber-500"
              />
            </div>
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-lg font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
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
