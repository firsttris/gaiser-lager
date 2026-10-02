import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { APP_ROOT_QUERY_KEYS, DEFAULT_REFETCH_INTERVAL_MS } from './utils/refresh'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: DEFAULT_REFETCH_INTERVAL_MS,
        refetchIntervalInBackground: false,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: true })

  if (typeof window !== 'undefined') {
    router.subscribe('onResolved', () => {
      void queryClient.invalidateQueries({
        predicate: (query) => APP_ROOT_QUERY_KEYS.includes(String(query.queryKey[0])),
      })
    })
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
