import { Link, useNavigate } from '@tanstack/react-router'
import { useAppState } from '../state/app-state'

export function TopNav() {
  const navigate = useNavigate()
  const { isLoggedIn, selectedCompany, logout } = useAppState()

  if (!isLoggedIn) return null

  return (
    <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:flex sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Gaiser Dashboard</p>
        <h2 className="font-title text-4xl leading-none text-slate-900">
          {isLoggedIn ? selectedCompany?.name : 'Login'}
        </h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
        <Link
          to="/wizard"
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          activeProps={{ className: 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white' }}
        >
          Neuer Vorgang
        </Link>
        <Link
          to="/history"
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          activeProps={{ className: 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white' }}
        >
          Historie
        </Link>

        {isLoggedIn && (
          <button
            type="button"
            onClick={() => {
              logout()
              void navigate({ to: '/' })
            }}
            className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200"
          >
            Abmelden
          </button>
        )}
      </div>
    </header>
  )
}
