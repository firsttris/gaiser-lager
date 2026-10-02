/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Build identifier, injected by vite.config.ts (also served as /version.json). */
declare const __APP_BUILD_ID__: string
/** Build time (ISO), injected by vite.config.ts. */
declare const __APP_BUILD_TIME__: string
/** Short git commit of the deployed version ('' for local builds). */
declare const __APP_BUILD_COMMIT__: string
