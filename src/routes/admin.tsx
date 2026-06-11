import { Outlet, createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Blocks, Building2, LogOut, MapPinned, Menu, ReceiptText, X } from 'lucide-react'
import { ClearDbButton } from '../components/clear-db-button'
import { NavLink } from '../components/nav-link'
import { PageShell } from '../components/page-shell'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin')({ component: AdminPage })

function AdminPage() {
  const { isAdminLoggedIn, adminLogin, adminLogout } = useAppState()
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function submitAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = adminLogin(password)
    if (!result.ok) {
      setAuthError(result.message)
      return
    }

    setAuthError('')
    setPassword('')
  }

  if (!isAdminLoggedIn) {
    return (
      <PageShell width="compact" className="py-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-28 -top-24 h-56 w-56 rounded-full bg-rose-100 blur-3xl"></div>
          <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-cyan-100 blur-3xl"></div>

          <div className="relative grid gap-8 sm:grid-cols-2">
            <div>
              <img src="/assets/Logo.jpeg" alt="Gaiser Logo" className="mb-4 h-16 w-auto" />
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-white uppercase">
                Admin
              </p>
              <h1 className="font-title mt-3 text-5xl text-slate-900">Gaiser-Lager Verwaltung</h1>
              <p className="mt-3 text-slate-600">
                Geschuetzter Bereich fuer Produktpflege und Firmenanlage.
              </p>
              <p className="mt-4 text-sm text-slate-500">Initiales Passwort fuer Demo: admin</p>
            </div>

            <form onSubmit={submitAdminLogin} className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="text-sm font-semibold text-slate-700">Admin-Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort eingeben"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
              />

              {authError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{authError}</p>}

              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                Als Admin anmelden
              </button>

              <Link
                to="/"
                className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
              >
                Zum Kundenportal
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
          <div className="flex items-center justify-between gap-4 sm:gap-8">
            <div className="flex min-w-0 items-center gap-4">
              <img src="/assets/Logo.jpeg" alt="Gaiser Logo" className="h-16 w-auto shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Admin</p>
                <h1 className="font-title text-3xl leading-none text-slate-900 sm:text-4xl">Verwaltung</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              <button
                type="button"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? 'Navigation schliessen' : 'Navigation oeffnen'}
                onClick={() => setIsMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-900 transition hover:bg-amber-100"
              >
                {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.25} /> : <Menu className="h-5 w-5" strokeWidth={2.25} />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
              <NavLink 
                to="/admin"
                compact
                activeOptions={{ exact: true }}
                onClick={() => setIsMenuOpen(false)}
                icon={<ReceiptText className="h-4 w-4" strokeWidth={2.25} />}
              >
                Historie
              </NavLink>

              <NavLink 
                to="/admin/products"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<Blocks className="h-4 w-4" strokeWidth={2.25} />}
              >
                Produkte
              </NavLink>

              <NavLink 
                to="/admin/companies"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<Building2 className="h-4 w-4" strokeWidth={2.25} />}
              >
                Firmen
              </NavLink>

              <NavLink
                to="/admin/sites"
                compact
                onClick={() => setIsMenuOpen(false)}
                icon={<MapPinned className="h-4 w-4" strokeWidth={2.25} />}
              >
                Baustellen
              </NavLink>

              <ClearDbButton className="mt-5" compact />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  adminLogout()
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
                Abmelden
              </button>
            </div>
          )}

          <div className="mt-4 hidden items-center gap-2 sm:flex sm:flex-row sm:flex-wrap">
            <NavLink 
              to="/admin"
              activeOptions={{ exact: true }}
              icon={<ReceiptText className="h-4 w-4" strokeWidth={2.25} />}
            >
              Historie
            </NavLink>
            <NavLink 
              to="/admin/products"
              icon={<Blocks className="h-4 w-4" strokeWidth={2.25} />}
            >
              Produkte
            </NavLink>
            <NavLink 
              to="/admin/companies"
              icon={<Building2 className="h-4 w-4" strokeWidth={2.25} />}
            >
              Firmen
            </NavLink>
            <NavLink
              to="/admin/sites"
              icon={<MapPinned className="h-4 w-4" strokeWidth={2.25} />}
            >
              Baustellen
            </NavLink>

            <div className="ml-auto flex items-center gap-2">
              <ClearDbButton />
              <button
                type="button"
                onClick={adminLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      <Outlet />
    </PageShell>
  )
}
