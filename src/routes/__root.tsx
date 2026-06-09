import { HeadContent, Scripts, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppStateProvider, useAppState } from '../state/app-state'
import { useEffect } from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#0f172a',
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
        title: 'Gaiser Dashboard',
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
  if (!hydrated) return null
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
