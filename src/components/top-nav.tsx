import { Link, useNavigate } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useAppState } from '../state/app-state'

export function TopNav() {
  const navigate = useNavigate()
  const { isLoggedIn, selectedCompany, logout } = useAppState()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuId = useId()

  if (!isLoggedIn) return null

  return (
    <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Gaiser Dashboard</p>
          <h2 className="font-title text-4xl leading-none text-slate-900">{selectedCompany?.name}</h2>
        </div>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          aria-label={isMenuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100 sm:hidden"
        >
          {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.25} /> : <Menu className="h-5 w-5" strokeWidth={2.25} />}
        </button>
      </div>

      <div id={menuId} className="mt-4 hidden gap-2 sm:flex sm:flex-row sm:flex-wrap">
        <Link
          to="/wizard"
          className="rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          activeProps={{ className: 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white' }}
        >
          Neuer Vorgang
        </Link>
        <Link
          to="/history"
          className="rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          activeProps={{ className: 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white' }}
        >
          Historie
        </Link>

        <button
          type="button"
          onClick={() => {
            logout()
            void navigate({ to: '/' })
          }}
          className="rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 hover:bg-amber-200"
        >
          Abmelden
        </button>
      </div>

      {isMenuOpen && (
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
          <Link
            to="/wizard"
            onClick={() => setIsMenuOpen(false)}
            className="block rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            activeProps={{ className: 'block rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white' }}
          >
            Neuer Vorgang
          </Link>
          <Link
            to="/history"
            onClick={() => setIsMenuOpen(false)}
            className="block rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            activeProps={{ className: 'block rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white' }}
          >
            Historie
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              logout()
              void navigate({ to: '/' })
            }}
            className="block w-full rounded-xl bg-amber-100 px-4 py-3 text-left text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
          >
            Abmelden
          </button>
        </div>
      )}
    </header>
  )
}
