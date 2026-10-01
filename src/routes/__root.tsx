import { HeadContent, Scripts, createRootRouteWithContext, Link } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { AppStateProvider, useAppState } from '../state/app-state'
import { useEffect } from 'react'
import { Spinner } from '../components/spinner'
import { EnvironmentBanner } from '../components/environment-banner'
import { isDevelopmentDatabase, isDevServerOnRemoteDatabase } from '../utils/environment'

import appCss from '../styles.css?url'

export type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      {
        name: 'theme-color',
        content: isDevelopmentDatabase ? '#facc15' : '#0f172a',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        title: isDevServerOnRemoteDatabase ? '[PROD!] Gaiser Lager' : isDevelopmentDatabase ? '[DEV] Gaiser Lager' : 'Gaiser Lager',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: `${import.meta.env.BASE_URL}manifest.webmanifest`,
      },
      {
        rel: 'apple-touch-icon',
        href: `${import.meta.env.BASE_URL}logo192.png`,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <p className="text-lg font-medium">Seite nicht gefunden</p>
      <Link to="/" className="text-sm underline text-muted-foreground">
        Zurück zur Startseite
      </Link>
    </div>
  ),
})

function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAppState()
  if (!hydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-slate-400" />
      </div>
    )
  }
  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const base = import.meta.env.BASE_URL
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
    }
  }, [])

  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <EnvironmentBanner />
        <AppStateProvider>
          <HydrationGate>{children}</HydrationGate>
        </AppStateProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
