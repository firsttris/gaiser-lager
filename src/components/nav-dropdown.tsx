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
          className={`inline-flex min-h-12 w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-semibold transition ${
            isActive ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
        className={`inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition ${
          isActive || isOpen ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-600 no-underline transition hover:bg-slate-50 hover:text-slate-900 data-[status=active]:bg-brand-50 data-[status=active]:text-brand-800"
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
