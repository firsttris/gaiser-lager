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
    ? 'inline-flex min-h-12 w-full items-center justify-start gap-3 whitespace-nowrap border-l-4 border-transparent px-3 py-3 text-sm font-semibold text-slate-600 no-underline transition hover:text-slate-800'
    : 'inline-flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 border-transparent text-sm font-semibold text-slate-600 no-underline transition hover:text-slate-800'

  const activeClasses = compact
    ? 'inline-flex min-h-12 w-full items-center justify-start gap-3 whitespace-nowrap border-l-4 border-amber-500 bg-amber-50/60 px-3 py-3 text-sm font-semibold text-slate-900 no-underline'
    : 'inline-flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 border-amber-500 text-sm font-semibold text-slate-900 no-underline'

  return (
    <Link className={baseClasses} activeProps={{ className: activeClasses }} {...props}>
      {icon}
      {children}
    </Link>
  )
}
