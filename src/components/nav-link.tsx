import { Link } from '@tanstack/react-router'
import type { ReactNode, ComponentProps } from 'react'

type RouterLinkProps = ComponentProps<typeof Link>

interface NavLinkProps extends Omit<RouterLinkProps, 'children' | 'className' | 'activeProps'> {
  children: ReactNode
  compact?: boolean
  icon?: ReactNode
}

export function NavLink({ children, compact = false, icon, ...props }: NavLinkProps) {
  const baseClasses = compact
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-200'
    : 'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-200'

  const activeClasses = compact
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline'
    : 'inline-flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-[0_15px_35px_rgba(15,23,42,0.3)]'

  return (
    <Link className={baseClasses} activeProps={{ className: activeClasses }} {...props}>
      {icon}
      {children}
    </Link>
  )
}
