import { useNavigate } from '@tanstack/react-router'
import { ClipboardPlus, History, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { InstallAppButton } from './install-app-button'
import { NavLink } from './nav-link'
import { useAppState } from '../state/app-state'

export function TopNav() {
  const navigate = useNavigate()
  const { isLoggedIn, selectedCompany, logout } = useAppState()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (!isLoggedIn) return null

  return (
    <header className="mb-6 space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Gaiser Lager</p>
            <h2 className="font-title text-4xl leading-none text-slate-900">{selectedCompany?.name}</h2>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-900 transition hover:bg-amber-100"
              aria-label={isMenuOpen ? 'Navigation schliessen' : 'Navigation oeffnen'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.15} /> : <Menu className="h-5 w-5" strokeWidth={2.15} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
            <NavLink
              to="/wizard"
              compact
              onClick={() => setIsMenuOpen(false)}
              icon={<ClipboardPlus className="h-4 w-4" strokeWidth={2.3} />}
            >
              Neuer Vorgang
            </NavLink>

            <NavLink
              to="/history"
              compact
              onClick={() => setIsMenuOpen(false)}
              icon={<History className="h-4 w-4" strokeWidth={2.3} />}
            >
              Historie
            </NavLink>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                logout()
                void navigate({ to: '/' })
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
            to="/wizard"
            icon={<ClipboardPlus className="h-4 w-4" strokeWidth={2.3} />}
          >
            Neuer Vorgang
          </NavLink>
          <NavLink
            to="/history"
            icon={<History className="h-4 w-4" strokeWidth={2.3} />}
          >
            Historie
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            <InstallAppButton />
            <button
              type="button"
              onClick={() => {
                logout()
                void navigate({ to: '/' })
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
