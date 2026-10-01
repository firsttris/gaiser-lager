import { defineConfig, loadEnv } from 'vite'
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

const config = defineConfig(({ command, mode }) => {
  if (command === 'serve' && !process.env.VITEST) assertLocalDatabaseForDev(mode)

  return {
    // Served from the domain root on Vercel (no GitHub Pages subpath anymore).
    base: '/',
    resolve: { tsconfigPaths: true },
    plugins: [
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
