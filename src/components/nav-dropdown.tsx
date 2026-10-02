import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from './nav-link'

interface NavDropdownItem {
  to: string
  label: string
  icon: ReactNode
}

export function NavDropdown({
  label,
  icon,
  items,
  compact = false,
  onNavigate,
}: {
  label: string
  icon: ReactNode
  items: NavDropdownItem[]
  compact?: boolean
  onNavigate?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isActive = items.some((item) => pathname.startsWith(item.to))

  useEffect(() => {
    if (!isOpen || compact) return

    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [isOpen, compact])

  if (compact) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className={`inline-flex min-h-12 w-full items-center justify-between gap-3 whitespace-nowrap border-l-4 px-3 py-3 text-sm font-semibold transition ${
            isActive ? 'border-amber-500 bg-amber-50/60 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="inline-flex items-center gap-3">
            {icon}
            {label}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.25} />
        </button>

        {isOpen && (
          <div className="mt-1 space-y-1 pl-4">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} compact onClick={onNavigate} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 text-sm font-semibold transition ${
          isActive ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-800'
        }`}
      >
        {icon}
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.25} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 min-w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-600 no-underline transition hover:bg-slate-50 hover:text-slate-900"
              activeProps={{
                className: 'flex min-h-12 items-center gap-3 rounded-lg bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700 no-underline',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
