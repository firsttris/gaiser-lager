const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export function isLocalSupabaseUrl(url: string | undefined) {
  if (!url) return false
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

// (import.meta.env is undefined while vite.config.ts imports this file.)
const env = import.meta.env as ImportMetaEnv | undefined

// True whenever the app talks to the local development database (a clone of
// production at best). Drives the "Entwicklung" banner, the [DEV] tab title
// and the watermark on generated PDFs, so local data and documents can't be
// mistaken for real ones.
export const isDevelopmentDatabase = isLocalSupabaseUrl(env?.VITE_SUPABASE_URL)

// Dev server deliberately started against a remote (production) database with
// ALLOW_PRODUCTION_DB=1 — shown as a loud warning instead.
export const isDevServerOnRemoteDatabase = Boolean(env?.DEV) && !isDevelopmentDatabase
