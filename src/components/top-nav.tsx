import { Building2, ClipboardPlus, History, LogOut, Menu, Receipt, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from './nav-link'
import { useAppState } from '../state/app-state'
import { Logo } from './logo'
import { FontScaleSwitch } from './font-scale-switch'

export function TopNav() {
  const { isLoggedIn, selectedCompany, logout } = useAppState()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (!isLoggedIn) return null

  return (
    <header className="mb-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex items-start justify-between gap-4 sm:gap-8">
          <div className="flex min-w-0 items-center gap-4">
            <Logo className="h-12 shrink-0 sm:h-16" />
          </div>

          <FontScaleSwitch className="header-font-switch ml-auto hidden sm:inline-flex" />

          <div className="hidden sm:block sm:text-left">
            <div className="mb-0.5 flex items-center justify-start gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.5} />
              <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Kunde</p>
            </div>
            <p className="font-title text-2xl leading-none text-slate-900">{selectedCompany?.name}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-800 transition hover:bg-brand-100"
              aria-label={isMenuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.15} /> : <Menu className="h-5 w-5" strokeWidth={2.15} />}
            </button>
          </div>
        </div>

        <div className="mt-5 sm:hidden">
          <div className="mb-0.5 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.5} />
            <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Kunde</p>
          </div>
          <h2 className="font-title text-2xl leading-tight text-slate-900">{selectedCompany?.name}</h2>
        </div>

        {isMenuOpen && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 sm:hidden">
            <NavLink
              to="/kunde/neuer-vorgang"
              compact
              onClick={() => setIsMenuOpen(false)}
              icon={<ClipboardPlus className="h-4 w-4" strokeWidth={2.3} />}
            >
              Neuer Vorgang
            </NavLink>

            <NavLink
              to="/kunde/vorgaenge"
              compact
              onClick={() => setIsMenuOpen(false)}
              icon={<History className="h-4 w-4" strokeWidth={2.3} />}
            >
              Vorgänge
            </NavLink>

            <NavLink
              to="/kunde/rechnungen"
              compact
              onClick={() => setIsMenuOpen(false)}
              icon={<Receipt className="h-4 w-4" strokeWidth={2.3} />}
            >
              Rechnungen
            </NavLink>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                void logout()
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
              Abmelden
            </button>
          </div>
        )}

        <div className="mt-5 hidden border-t border-slate-100 pt-4 sm:flex sm:items-center sm:gap-2">
          <NavLink
            to="/kunde/neuer-vorgang"
            icon={<ClipboardPlus className="h-4 w-4" strokeWidth={2.3} />}
          >
            Neuer Vorgang
          </NavLink>
          <NavLink
            to="/kunde/vorgaenge"
            icon={<History className="h-4 w-4" strokeWidth={2.3} />}
          >
            Vorgänge
          </NavLink>
          <NavLink
            to="/kunde/rechnungen"
            icon={<Receipt className="h-4 w-4" strokeWidth={2.3} />}
          >
            Rechnungen
          </NavLink>

          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => {
                void logout()
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
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
