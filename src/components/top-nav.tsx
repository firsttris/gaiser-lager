import { useNavigate } from '@tanstack/react-router'
import { Building2, ClipboardPlus, History, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from './nav-link'
import { useAppState } from '../state/app-state'
import { Logo } from './logo'

export function TopNav() {
  const navigate = useNavigate()
  const { isLoggedIn, selectedCompany, logout } = useAppState()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (!isLoggedIn) return null

  return (
    <header className="mb-8">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-8">
        <div className="flex items-start justify-between gap-4 sm:gap-8">
          <div className="flex min-w-0 items-center gap-4">
            <Logo className="h-12 shrink-0 sm:h-16" />
          </div>

          <div className="hidden sm:block sm:text-left">
            <div className="mb-0.5 flex items-center justify-start gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
              <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">Kunde</p>
            </div>
            <p className="font-title text-2xl leading-none text-slate-900">{selectedCompany?.name}</p>
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

        <div className="mt-5 sm:hidden">
          <div className="mb-0.5 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
            <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">Kunde</p>
          </div>
          <h2 className="font-title text-2xl leading-tight text-slate-900">{selectedCompany?.name}</h2>
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
