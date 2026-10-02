/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { isLocalSupabaseUrl } from '../src/utils/environment'
import { FIXTURES_FILE, type E2eFixtures } from './support'

function readEnvFile(file: string) {
  if (!fs.existsSync(file)) return {}
  const entries = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')])
  return Object.fromEntries(entries) as Record<string, string>
}

// Creates fresh test data for this run, so tests never depend on what is
// already in the database and can run again without a reset.
export default async function globalSetup() {
  const env = { ...readEnvFile(path.resolve('.env')), ...process.env }
  const url = env.VITE_SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) throw new Error('VITE_SUPABASE_URL / SUPABASE_SECRET_KEY fehlen. Zuerst `npm run db:start` ausführen.')
  if (!isLocalSupabaseUrl(url)) throw new Error(`E2E-Tests laufen nur gegen die lokale Datenbank, nicht gegen ${url}.`)

  const supabase = createClient(url, secretKey, { auth: { persistSession: false } })
  const runId = Date.now().toString(36).slice(-6).toUpperCase()
  const fixtures: E2eFixtures = {
    runId,
    company: { name: `E2E Bau ${runId}`, pin: '2468' },
    driver: { name: `E2E Fahrer ${runId}`, pin: '1357' },
    admin: { email: 'e2e-admin@gaiser.local', password: 'e2e-passwort-123' },
    masterPin: '1234',
  }

  const { error: companyError } = await supabase
    .from('companies')
    .insert({ name: fixtures.company.name, pin_hash: bcrypt.hashSync(fixtures.company.pin, 4), email: 'e2e@example.com' })
  if (companyError) throw new Error(`Testfirma: ${companyError.message}`)

  const { error: driverError } = await supabase
    .from('employees')
    .insert({ name: fixtures.driver.name, pin_hash: bcrypt.hashSync(fixtures.driver.pin, 4) })
  if (driverError) throw new Error(`Testfahrer: ${driverError.message}`)

  // Known master PIN and no lockout from earlier runs (local database only).
  const { error: settingsError } = await supabase
    .from('signup_settings')
    .update({ master_pin_hash: bcrypt.hashSync(fixtures.masterPin, 4), failed_pin_attempts: 0, pin_locked_until: null })
    .eq('id', true)
  if (settingsError) throw new Error(`Master-PIN: ${settingsError.message}`)

  const { data: users } = await supabase.auth.admin.listUsers()
  let admin = users?.users.find((user) => user.email === fixtures.admin.email)
  if (!admin) {
    const { data, error } = await supabase.auth.admin.createUser({ ...fixtures.admin, email_confirm: true })
    if (error || !data.user) throw new Error(`Test-Admin: ${error?.message}`)
    admin = data.user
  } else {
    await supabase.auth.admin.updateUserById(admin.id, { password: fixtures.admin.password })
  }
  const { error: adminError } = await supabase.from('admin_users').upsert({ user_id: admin.id })
  if (adminError) throw new Error(`Admin-Rolle: ${adminError.message}`)

  fs.mkdirSync(path.dirname(FIXTURES_FILE), { recursive: true })
  fs.writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2))
}
