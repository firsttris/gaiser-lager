#!/usr/bin/env node
// Local development database (Supabase via Docker or Podman).
//
//   npm run db:start   start local Supabase, write .env with the local keys
//   npm run db:stop    stop it
//   npm run db:reset   rebuild the local DB from supabase/migrations (empty)
//   npm run db:clone   copy the production data into the local DB
//
// Safety rules, enforced below and not just by convention:
// - Everything that writes goes to the local database only. Before writing,
//   the target URL is checked to be 127.0.0.1/localhost, and the Supabase CLI
//   is always called with --local, never --linked (this repo is linked to the
//   production project, so `db reset --linked` would wipe production).
// - Production is only ever *read*, with pg_dump, using the credentials in
//   .env.prod (git-ignored, never loaded by Vite).

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '..')
const PROJECT_ID = /^project_id\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8'))[1]
const LOCAL_DB_CONTAINER = `supabase_db_${PROJECT_ID}`
// Not needed for this app; skipping them keeps `db:start` fast and light.
const EXCLUDED_SERVICES = 'studio,imgproxy,vector,logflare,edge-runtime,realtime,supavisor,mailpit,postgres-meta'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const PRODUCT_IMAGE_BUCKET = 'product-images'
const DEV_ADMIN = { email: 'admin@gaiser.local', password: 'entwicklung' }

const ENV_FILE = path.join(ROOT, '.env')
const PROD_ENV_FILE = path.join(ROOT, '.env.prod')

// ---------------------------------------------------------------------------
// helpers

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function step(message) {
  console.log(`\n▸ ${message}`)
}

function commandExists(cmd) {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0
}

const CONTAINER_RUNTIME = commandExists('docker') ? 'docker' : commandExists('podman') ? 'podman' : null

function runtimeEnv() {
  const env = { ...process.env }
  // The Supabase CLI talks to the Docker API; with Podman that's the user socket.
  if (CONTAINER_RUNTIME === 'podman' && !env.DOCKER_HOST && env.XDG_RUNTIME_DIR) {
    const socket = path.join(env.XDG_RUNTIME_DIR, 'podman/podman.sock')
    if (fs.existsSync(socket)) env.DOCKER_HOST = `unix://${socket}`
  }
  return env
}

function supabase(args, { capture = false } = {}) {
  if (args.includes('--linked') || args.includes('--db-url')) {
    fail(`Interner Fehler: supabase ${args.join(' ')} würde nicht die lokale Datenbank verwenden.`)
  }
  const result = spawnSync('npx', ['supabase', ...args], {
    cwd: ROOT,
    env: runtimeEnv(),
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? '')
    fail(`supabase ${args.join(' ')} ist fehlgeschlagen.`)
  }
  return result.stdout ?? ''
}

function localStatus() {
  const out = supabase(['status', '-o', 'json'], { capture: true })
  const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)
  let status
  try {
    status = JSON.parse(json)
  } catch {
    fail('Lokale Supabase läuft nicht. Bitte zuerst `npm run db:start` ausführen.')
  }
  assertLocalUrl('Lokale API', status.API_URL)
  assertLocalUrl('Lokale Datenbank', status.DB_URL)
  return {
    apiUrl: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  }
}

function isLocalUrl(url) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function assertLocalUrl(label, url) {
  if (!isLocalUrl(url)) fail(`${label} zeigt nicht auf diesen Rechner (${url}). Abbruch, um die Produktion zu schützen.`)
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const entries = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match) entries[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return entries
}

// psql inside the local database container, as superuser (needed for
// session_replication_role, which skips FK checks and triggers during restore).
function psqlLocal(sql) {
  const result = spawnSync(
    CONTAINER_RUNTIME,
    ['exec', '-i', LOCAL_DB_CONTAINER, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
  )
  return { ok: result.status === 0, error: (result.stderr ?? '').trim() }
}

// pg_dump against production, in a throwaway container using the same
// Postgres image as the local database. Read-only: pg_dump only SELECTs.
// The password goes through an env file, not the command line.
function pgDumpProduction(prodDbUrl, args) {
  const url = new URL(prodDbUrl)
  const password = decodeURIComponent(url.password)
  url.password = ''

  const image = spawnSync(CONTAINER_RUNTIME, ['inspect', LOCAL_DB_CONTAINER, '--format', '{{.ImageName}}'], { encoding: 'utf8' })
    .stdout?.trim()
  if (!image) fail('Image der lokalen Datenbank nicht gefunden. Läuft `npm run db:start`?')

  // Under distrobox the runtime may run on the host, so the env file has to
  // live somewhere both sides see — the home directory.
  const dir = fs.mkdtempSync(path.join(os.homedir(), '.cache', 'gaiser-db-clone-'))
  const envFile = path.join(dir, 'pg.env')
  fs.writeFileSync(envFile, `PGPASSWORD=${password}\nPGSSLMODE=${url.hostname === '127.0.0.1' ? 'disable' : 'require'}\n`, { mode: 0o600 })
  try {
    const result = spawnSync(
      CONTAINER_RUNTIME,
      ['run', '--rm', '--network', 'host', '--env-file', envFile, image, 'pg_dump', `--dbname=${url.toString()}`, '--no-owner', '--no-privileges', ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2 * 1024 * 1024 * 1024 },
    )
    if (result.status !== 0) fail(`pg_dump gegen die Produktion ist fehlgeschlagen:\n${result.stderr}`)
    return result.stdout
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function readProductionConfig() {
  if (!fs.existsSync(PROD_ENV_FILE)) {
    fail('.env.prod fehlt. Vorlage: .env.prod.example (PROD_DB_URL = Connection-String aus Supabase → Connect → Session pooler).')
  }
  const env = parseEnvFile(PROD_ENV_FILE)
  if (!env.PROD_DB_URL) fail('PROD_DB_URL fehlt in .env.prod.')
  // Escape hatch for testing the clone against a local stand-in database.
  if (isLocalUrl(env.PROD_DB_URL) && process.env.DB_CLONE_ALLOW_LOCAL_SOURCE !== '1') {
    fail('PROD_DB_URL zeigt auf diesen Rechner — das ist keine Produktionsdatenbank.')
  }
  return { dbUrl: env.PROD_DB_URL, supabaseUrl: env.PROD_SUPABASE_URL }
}

// ---------------------------------------------------------------------------
// .env for local development

function writeLocalEnv(local) {
  const existing = parseEnvFile(ENV_FILE)
  if (existing.VITE_SUPABASE_URL && !isLocalUrl(existing.VITE_SUPABASE_URL)) {
    fail(
      '.env enthält Zugangsdaten einer entfernten Datenbank (vermutlich Produktion).\n' +
        '  Bitte nach .env.prod verschieben (siehe .env.prod.example); .env ist nur noch für die lokale Datenbank.',
    )
  }

  const content = [
    '# Lokale Entwicklung — wird von `npm run db:start` geschrieben.',
    '# Produktions-Zugangsdaten gehören NICHT hierher, sondern nach .env.prod.',
    `VITE_SUPABASE_URL=${local.apiUrl}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${local.publishableKey}`,
    `SUPABASE_SECRET_KEY=${local.secretKey}`,
    `SESSION_SECRET=${existing.SESSION_SECRET || crypto.randomBytes(32).toString('base64')}`,
    '',
  ].join('\n')

  if (fs.existsSync(ENV_FILE) && fs.readFileSync(ENV_FILE, 'utf8') === content) return
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 })
  console.log('  .env auf die lokale Datenbank gesetzt.')
}

// ---------------------------------------------------------------------------
// commands

function start() {
  if (!CONTAINER_RUNTIME) fail('Weder docker noch podman gefunden.')
  step('Starte lokale Supabase …')
  supabase(['start', '-x', EXCLUDED_SERVICES])
  writeLocalEnv(localStatus())
  console.log('\n✔ Lokale Datenbank läuft. Leer? → `npm run db:clone` holt die Produktionsdaten.')
}

function stop() {
  supabase(['stop'])
}

function reset() {
  localStatus()
  step('Baue lokale Datenbank aus supabase/migrations neu auf …')
  supabase(['db', 'reset', '--local'])
}

async function ensureDevAdmin(local) {
  const client = createClient(local.apiUrl, local.secretKey, { auth: { persistSession: false } })
  const { data: list } = await client.auth.admin.listUsers()
  let user = list?.users.find((u) => u.email === DEV_ADMIN.email)
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({ ...DEV_ADMIN, email_confirm: true })
    if (error) return console.warn(`  ⚠ Lokaler Admin konnte nicht angelegt werden: ${error.message}`)
    user = data.user
  }
  await client.from('admin_users').upsert({ user_id: user.id })
}

async function copyProductImages(local, prodSupabaseUrl) {
  if (!prodSupabaseUrl) return console.warn('  ⚠ PROD_SUPABASE_URL fehlt in .env.prod — Materialbilder werden nicht kopiert.')
  const client = createClient(local.apiUrl, local.secretKey, { auth: { persistSession: false } })
  const { data: products } = await client.from('products').select('image_path').not('image_path', 'is', null)
  let copied = 0
  for (const { image_path: imagePath } of products ?? []) {
    // Public bucket: downloading needs no credentials.
    const response = await fetch(`${prodSupabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${imagePath}`)
    if (!response.ok) {
      console.warn(`  ⚠ Bild ${imagePath} nicht gefunden (${response.status}).`)
      continue
    }
    const { error } = await client.storage.from(PRODUCT_IMAGE_BUCKET).upload(imagePath, await response.arrayBuffer(), {
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      upsert: true,
    })
    if (error) console.warn(`  ⚠ Bild ${imagePath} konnte lokal nicht gespeichert werden: ${error.message}`)
    else copied++
  }
  console.log(`  ${copied} Materialbild(er) kopiert.`)
}

async function clone() {
  const prod = readProductionConfig()
  const local = localStatus()

  step('Lese Produktionsdaten (nur lesend, pg_dump) …')
  const publicData = pgDumpProduction(prod.dbUrl, ['--data-only', '--schema=public'])
  const authData = pgDumpProduction(prod.dbUrl, ['--data-only', '--table=auth.users', '--table=auth.identities'])

  step('Setze lokale Datenbank zurück (Schema aus supabase/migrations) …')
  supabase(['db', 'reset', '--local'])

  step('Spiele Daten lokal ein …')
  // One transaction: if anything fails, the local DB stays freshly reset
  // instead of half-filled. The migrations seed a few rows (products, trucks,
  // settings) that the production data replaces, so public is emptied first.
  const restorePublic = psqlLocal(`
    begin;
    set session_replication_role = replica;
    do $$ declare t record; begin
      for t in select tablename from pg_tables where schemaname = 'public' loop
        execute format('truncate table public.%I cascade', t.tablename);
      end loop;
    end $$;
    ${publicData}
    commit;
  `)
  if (!restorePublic.ok) fail(`Einspielen der Daten fehlgeschlagen:\n${restorePublic.error}`)

  // Separate transaction: if the production auth schema has columns the local
  // auth version doesn't know yet, the business data is still there and only
  // the production logins are missing (the local dev admin below still works).
  const restoreAuth = psqlLocal(`
    begin;
    set session_replication_role = replica;
    delete from auth.identities;
    delete from auth.users;
    ${authData}
    commit;
  `)
  if (!restoreAuth.ok) {
    console.warn(`  ⚠ Admin-Logins aus der Produktion konnten nicht übernommen werden:\n    ${restoreAuth.error.split('\n')[0]}`)
  }

  await ensureDevAdmin(local)
  await copyProductImages(local, prod.supabaseUrl)

  const client = createClient(local.apiUrl, local.secretKey, { auth: { persistSession: false } })
  const count = async (table) => (await client.from(table).select('*', { count: 'exact', head: true })).count ?? 0
  console.log(
    `\n✔ Lokale Datenbank ist jetzt ein Abbild der Produktion (${new Date().toLocaleString('de-DE')}):` +
      `\n  ${await count('companies')} Firmen, ${await count('records')} Vorgänge, ${await count('products')} Materialien` +
      `\n  Admin-Login: ${restoreAuth.ok ? 'wie in der Produktion, oder ' : ''}${DEV_ADMIN.email} / ${DEV_ADMIN.password}` +
      '\n  Kunden-PINs sind dieselben wie in der Produktion.',
  )
}

const commands = { start, stop, reset, clone }
const command = commands[process.argv[2]]
if (!command) fail(`Unbekannter Befehl. Verfügbar: ${Object.keys(commands).join(', ')}`)
await command()
