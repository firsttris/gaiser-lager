import { Outlet, createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Blocks, Building2, LogOut, Menu, ReceiptText, X } from 'lucide-react'
import { InstallAppButton } from '../components/install-app-button'
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
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-white uppercase">
                Admin
              </p>
              <h1 className="font-title mt-3 text-5xl text-slate-900">Gaiser Verwaltung</h1>
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
                Zurueck zur Startseite
              </Link>
            </form>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <header className="mb-6 space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Admin Bereich</p>
              <h1 className="font-title text-5xl text-slate-900">Gaiser Verwaltung</h1>
            </div>

            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Navigation schliessen' : 'Navigation oeffnen'}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-900 transition hover:bg-amber-100 sm:hidden"
            >
              {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.25} /> : <Menu className="h-5 w-5" strokeWidth={2.25} />}
            </button>
          </div>

          {isMenuOpen && (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
              <Link
                to="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-200"
                activeOptions={{ exact: true }}
                activeProps={{
                  className:
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline',
                }}
              >
                <ReceiptText className="h-4 w-4" strokeWidth={2.25} />
                History
              </Link>

              <Link
                to="/admin/products"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-200"
                activeProps={{
                  className:
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline',
                }}
              >
                <Blocks className="h-4 w-4" strokeWidth={2.25} />
                Produkte
              </Link>

              <Link
                to="/admin/companies"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-200"
                activeProps={{
                  className:
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline',
                }}
              >
                <Building2 className="h-4 w-4" strokeWidth={2.25} />
                Firmen
              </Link>

              <InstallAppButton compact className="w-full justify-center" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  adminLogout()
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
                Abmelden
              </button>
            </div>
          )}

          <div className="mt-4 hidden items-center gap-2 sm:flex sm:flex-row sm:flex-wrap">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:-translate-y-0.5 hover:bg-slate-200"
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-[0_10px_24px_rgba(15,23,42,0.2)]',
              }}
            >
              <ReceiptText className="h-4 w-4" strokeWidth={2.25} />
              History
            </Link>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:-translate-y-0.5 hover:bg-slate-200"
              activeProps={{
                className:
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-[0_10px_24px_rgba(15,23,42,0.2)]',
              }}
            >
              <Blocks className="h-4 w-4" strokeWidth={2.25} />
              Produkte
            </Link>
            <Link
              to="/admin/companies"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:-translate-y-0.5 hover:bg-slate-200"
              activeProps={{
                className:
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-[0_10px_24px_rgba(15,23,42,0.2)]',
              }}
            >
              <Building2 className="h-4 w-4" strokeWidth={2.25} />
              Firmen
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <InstallAppButton />
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

        <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_18px_35px_rgba(15,23,42,0.14)] backdrop-blur sm:hidden">
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/admin"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-100"
              activeOptions={{ exact: true }}
              activeProps={{
                className:
                  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white no-underline',
              }}
            >
              <ReceiptText className="h-4 w-4" strokeWidth={2.25} />
              History
            </Link>
            <Link
              to="/admin/products"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-100"
              activeProps={{
                className:
                  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white no-underline',
              }}
            >
              <Blocks className="h-4 w-4" strokeWidth={2.25} />
              Produkte
            </Link>
            <Link
              to="/admin/companies"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-100"
              activeProps={{
                className:
                  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white no-underline',
              }}
            >
              <Building2 className="h-4 w-4" strokeWidth={2.25} />
              Firmen
            </Link>
          </div>
        </nav>
      </header>

      <Outlet />
    </PageShell>
  )
}
