import { Outlet, createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { Blocks, Building2, Clock, HardHat, LogOut, Mail, MapPinned, Menu, PlusCircle, Receipt, ReceiptText, Settings, ShieldCheck, X } from 'lucide-react'
import { NavLink } from '../components/nav-link'
import { NavDropdown } from '../components/nav-dropdown'
import { PageShell } from '../components/page-shell'
import { useAppState } from '../state/app-state'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { InactivityGuard } from '../components/inactivity-guard'

// An untouched admin login on the kiosk must not block the customers: after
// this long without input it returns to the customer login.
const ADMIN_LOGIN_IDLE_MS = 60_000
const IDLE_RESET_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart']

export const Route = createFileRoute('/admin')({ component: AdminPage })

const settingsNavItems = [
  { to: '/admin/material', label: 'Material', icon: <Blocks className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/lkw', label: 'LKW', icon: <Clock className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/kunden', label: 'Kunden', icon: <Building2 className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/baustellen', label: 'Baustellen', icon: <MapPinned className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/mitarbeiter', label: 'Mitarbeiter', icon: <HardHat className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/e-mail', label: 'E-Mail', icon: <Mail className="h-4 w-4" strokeWidth={2.25} /> },
  { to: '/admin/einstellungen', label: 'Einstellungen', icon: <Settings className="h-4 w-4" strokeWidth={2.25} /> },
]

function AdminPage() {
  const { isAdminLoggedIn, adminLogin, isAdminLoggingIn, adminLogout, isLoggingOut, signupSettings } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLoginPage = pathname === '/admin' || pathname === '/admin/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  async function submitAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await adminLogin(email, password)
    if (!result.ok) {
      setAuthError(result.message)
      return
    }

    setAuthError('')
    setPassword('')
  }

  // Session gone on an admin sub-page (expired, logged out elsewhere): back to
  // the customer login, never to the admin login (the kiosk would get stuck).
  // Reads the query cache directly (see kunde.tsx).
  // Only on /admin pages: while leaving the admin area (e.g. to "Passwort
  // vergessen") this layout briefly sees the new path and must not redirect.
  const isAdminSubPage = pathname.startsWith('/admin/') && !isLoginPage
  useEffect(() => {
    const session = queryClient.getQueryData(adminSessionStatusQueryOptions().queryKey)
    if (!session?.isAdminLoggedIn && isAdminSubPage && !isLoggingOut) window.location.assign('/')
  }, [isAdminLoggedIn, isAdminSubPage, isLoggingOut, queryClient])

  useEffect(() => {
    if (isAdminLoggedIn || !isLoginPage) return
    let timer = setTimeout(() => void navigate({ to: '/' }), ADMIN_LOGIN_IDLE_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void navigate({ to: '/' }), ADMIN_LOGIN_IDLE_MS)
    }
    for (const eventName of IDLE_RESET_EVENTS) window.addEventListener(eventName, reset, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const eventName of IDLE_RESET_EVENTS) window.removeEventListener(eventName, reset)
    }
  }, [isAdminLoggedIn, isLoginPage, navigate])

  if (!isAdminLoggedIn && !isLoginPage) return null

  if (!isAdminLoggedIn) {
    return (
      <PageShell>
        <section className="relative mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-28 -top-24 h-56 w-56 rounded-full bg-rose-100 blur-3xl"></div>
          <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-cyan-100 blur-3xl"></div>

          <div className="relative grid gap-8 p-6 sm:grid-cols-2 sm:p-10">
            <div>
              <Logo className="mb-4 h-16" />
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-white uppercase">
                Admin
              </p>
              <h1 className="font-title mt-3 text-5xl text-slate-900">Gaiser-Lager Verwaltung</h1>
              <p className="mt-3 text-slate-600">
                Geschützter Bereich für Produktpflege und Kundenanlage.
              </p>
            </div>

            <form onSubmit={submitAdminLogin} className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="text-sm font-semibold text-slate-700">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-Mail eingeben"
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
              />

              <label className="mt-4 block text-sm font-semibold text-slate-700">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort eingeben"
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
              />

              {authError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{authError}</p>}

              <button
                type="submit"
                disabled={isAdminLoggingIn}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdminLoggingIn && <Spinner className="h-4 w-4" />}
                Als Admin anmelden
              </button>

              <Link
                to="/"
                className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
              >
                Zurück zur Kunden-Anmeldung
              </Link>

              <Link
                to="/passwort-vergessen"
                className="mt-3 flex min-h-12 items-center justify-center text-sm font-semibold text-slate-700 no-underline hover:text-slate-900"
              >
                Passwort vergessen?
              </Link>
            </form>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <header className="mb-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-8">
          <div className="flex items-start justify-between gap-4 sm:gap-8">
            <div className="flex min-w-0 items-center gap-4">
              <Logo className="h-12 shrink-0 sm:h-16" />
            </div>

            <div className="hidden items-start gap-6 sm:flex">
              <div className="text-left">
                <div className="mb-0.5 flex items-center justify-start gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
                  <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">Admin</p>
                </div>
                <h1 className="font-title text-2xl leading-none text-slate-900">Verwaltung</h1>
              </div>
              {/* Up here instead of in the navigation row: on the portrait
                  tablet the row has no room left for it. */}
              <button
                type="button"
                onClick={() => void adminLogout()}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
                Abmelden
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              <button
                type="button"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
                onClick={() => setIsMenuOpen((open) => !open)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-900 transition hover:bg-amber-100"
              >
                {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.25} /> : <Menu className="h-5 w-5" strokeWidth={2.25} />}
              </button>
            </div>
          </div>

          <div className="mt-5 sm:hidden">
            <div className="mb-0.5 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
              <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">Admin</p>
            </div>
            <h1 className="font-title text-2xl leading-tight text-slate-900">Verwaltung</h1>
          </div>

          {isMenuOpen && (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
              <NavLink
                to="/admin/neuer-vorgang"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<PlusCircle className="h-4 w-4" strokeWidth={2.25} />}
              >
                Neuer Vorgang
              </NavLink>

              <NavLink
                to="/admin/vorgaenge"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<ReceiptText className="h-4 w-4" strokeWidth={2.25} />}
              >
                Vorgänge
              </NavLink>

              <NavLink
                to="/admin/rechnungen"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<Receipt className="h-4 w-4" strokeWidth={2.25} />}
              >
                Rechnungen
              </NavLink>

              <NavDropdown
                label="Einstellungen"
                icon={<Settings className="h-4 w-4" strokeWidth={2.25} />}
                items={settingsNavItems}
                compact
                onNavigate={() => setIsMenuOpen(false)}
              />

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    void adminLogout()
                  }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  <LogOut className="h-4 w-4" strokeWidth={2.2} />
                  Abmelden
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 hidden flex-wrap border-t border-slate-100 pt-2 sm:flex sm:items-center sm:gap-x-4 sm:gap-y-1">
            <NavLink
              to="/admin/neuer-vorgang"
              icon={<PlusCircle className="h-4 w-4" strokeWidth={2.25} />}
            >
              Neuer Vorgang
            </NavLink>
            <NavLink
              to="/admin/vorgaenge"
              icon={<ReceiptText className="h-4 w-4" strokeWidth={2.25} />}
            >
              Vorgänge
            </NavLink>
            <NavLink
              to="/admin/rechnungen"
              icon={<Receipt className="h-4 w-4" strokeWidth={2.25} />}
            >
              Rechnungen
            </NavLink>
            <NavDropdown
              label="Einstellungen"
              icon={<Settings className="h-4 w-4" strokeWidth={2.25} />}
              items={settingsNavItems}
            />

          </div>
        </div>
      </header>

      <Outlet />
      <InactivityGuard
        timeoutMinutes={signupSettings.adminInactivityTimeoutMinutes}
        onLogout={adminLogout}
        isLoggingOut={isLoggingOut}
      />
    </PageShell>
  )
}
