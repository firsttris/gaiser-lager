// How often data is re-fetched while a page stays open. The kiosk tablet is
// permanently in the foreground, so the usual refetch on window focus never
// fires there; without polling, records or customers created elsewhere would
// only show up after a manual reload.
export const DEFAULT_REFETCH_INTERVAL_MS = 60_000
export const LIST_REFETCH_INTERVAL_MS = 30_000

// Query keys of the data loaded once at the app root (AppStateProvider). They
// don't remount on navigation, so they're refreshed on every route change.
export const APP_ROOT_QUERY_KEYS = ['auth', 'companies', 'products', 'trucks', 'construction-sites', 'signup-settings']
