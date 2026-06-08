import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  className?: string
  width?: 'default' | 'compact'
}

const widthClasses: Record<NonNullable<PageShellProps['width']>, string> = {
  default: 'max-w-6xl lg:max-w-7xl',
  compact: 'max-w-4xl lg:max-w-6xl',
}

export function PageShell({ children, className = '', width = 'default' }: PageShellProps) {
  return <main className={`mx-auto w-full ${widthClasses[width]} px-4 py-6 sm:px-8 ${className}`}>{children}</main>
}
