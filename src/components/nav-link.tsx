import { Link } from '@tanstack/react-router'
import type { ReactNode, ComponentProps } from 'react'

type RouterLinkProps = ComponentProps<typeof Link>

interface NavLinkProps extends Omit<RouterLinkProps, 'children' | 'className' | 'activeProps'> {
  children: ReactNode
  compact?: boolean
  icon?: ReactNode
}

// The active page gets a brand-coloured pill: readable from a distance on the
// kiosk tablet, unlike bold text alone. Styled via TanStack's data-status
// attribute; className + activeProps would be merged and the colours clash.
const PILL =
  'inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-slate-600 no-underline transition hover:bg-slate-100 hover:text-slate-900 data-[status=active]:bg-brand-50 data-[status=active]:text-brand-800 data-[status=active]:ring-1 data-[status=active]:ring-brand-200 data-[status=active]:ring-inset'

export function NavLink({ children, compact = false, icon, ...props }: NavLinkProps) {
  return (
    <Link className={compact ? `${PILL} w-full justify-start gap-3 py-3` : PILL} {...props}>
      {icon}
      {children}
    </Link>
  )
}
