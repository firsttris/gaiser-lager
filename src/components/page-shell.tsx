import type { ReactNode } from 'react'
import { FontScaleSwitch } from './font-scale-switch'
import { AppVersion } from './app-version'

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
  return (
    <main className={`mx-auto w-full ${widthClasses[width]} px-4 py-6 sm:px-8 ${className}`}>
      {/* Hidden from sm up when the page header carries its own switch
          (see .header-font-switch in styles.css). */}
      <div className="page-font-switch mb-3 flex justify-end">
        <FontScaleSwitch />
      </div>
      {children}
      <AppVersion />
    </main>
  )
}
