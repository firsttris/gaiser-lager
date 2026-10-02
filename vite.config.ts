import { defineConfig, loadEnv, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { isLocalSupabaseUrl } from './src/utils/environment'

// The dev server must never run against production by accident: refuse to
// start unless the configured Supabase is local (`npm run db:start`), or the
// override is set explicitly for a single run.
function assertLocalDatabaseForDev(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')
  const url = env.VITE_SUPABASE_URL
  if (isLocalSupabaseUrl(url) || process.env.ALLOW_PRODUCTION_DB === '1') return
  throw new Error(
    `\n\n  Der Dev-Server würde gegen eine entfernte Datenbank laufen (${url}).\n` +
      '  Für die Entwicklung: `npm run db:start` (und ggf. `npm run db:clone`).\n' +
      '  Nur wenn wirklich gewollt: ALLOW_PRODUCTION_DB=1 npm run dev\n',
  )
}

// Identifies this build. Baked into the client and also published as
// /version.json, so an open kiosk page can notice that a newer version has
// been deployed and reload itself (see useReloadOnNewVersion).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36)
// Shown at the bottom of every page (with the commit), so it's easy to check
// which version a device is running.
const BUILD_TIME = new Date().toISOString()
const BUILD_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? ''

function versionFile(): Plugin {
  return {
    name: 'gaiser-version-file',
    apply: 'build',
    generateBundle() {
      if (this.environment.name !== 'client') return
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) })
    },
  }
}

const config = defineConfig(({ command, mode }) => {
  if (command === 'serve' && !process.env.VITEST) assertLocalDatabaseForDev(mode)

  return {
    // Served from the domain root on Vercel (no GitHub Pages subpath anymore).
    base: '/',
    resolve: { tsconfigPaths: true },
    define: {
      __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
      __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
      __APP_BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    },
    plugins: [
      versionFile(),
      devtools(),
      tailwindcss(),
      // Prerendering is off: /admin and /kunde routes are now guarded by
      // server-side beforeLoad checks against a real request/session, which
      // don't make sense to run at build time.
      tanstackStart(),
      viteReact(),
      // Compiles the server output into Vercel Functions; without this Vercel
      // has nothing to run and every route 404s.
      nitro(),
    ],
  }
})

export default config
