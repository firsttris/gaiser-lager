import { createServerFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import type { Database } from '#/lib/supabase/types'

type TableName = keyof Database['public']['Tables']

// Data-only dump: table order respects foreign keys (companies,
// construction_sites and employees before records, which references them). Schema itself
// lives in supabase/migrations/ and is not repeated here.
const TABLES_IN_DEPENDENCY_ORDER = [
  'companies',
  'construction_sites',
  'admin_users',
  'employees',
  'products',
  'trucks',
  'numbering_settings',
  'signup_settings',
  'records',
  // Only the metadata; the photo files themselves live in Supabase Storage.
  'delivery_note_photos',
] as const satisfies ReadonlyArray<TableName>

// Tables with a serial/bigserial id column — after inserting explicit ids,
// the sequence needs to be fast-forwarded past the highest one used.
const SEQUENCE_TABLES = ['products', 'trucks', 'records'] as const

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

// PostgREST caps every response at max_rows (1000, see supabase/config.toml),
// so each table is read page by page in a stable order until a short page
// comes back — a single select('*') silently truncated larger tables.
const PAGE_SIZE = 1000

const ORDER_COLUMN: Record<(typeof TABLES_IN_DEPENDENCY_ORDER)[number], string> = {
  companies: 'id',
  construction_sites: 'id',
  admin_users: 'user_id',
  employees: 'id',
  delivery_note_photos: 'id',
  products: 'id',
  trucks: 'id',
  numbering_settings: 'id',
  signup_settings: 'id',
  records: 'id',
}

async function fetchAllRows(supabase: SupabaseClient<Database>, table: (typeof TABLES_IN_DEPENDENCY_ORDER)[number]) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(ORDER_COLUMN[table], { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Backup fehlgeschlagen (Tabelle "${table}"): ${error.message}`)
    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function dumpTable(supabase: SupabaseClient<Database>, table: (typeof TABLES_IN_DEPENDENCY_ORDER)[number]) {
  const rows = await fetchAllRows(supabase, table)
  if (rows.length === 0) return `-- Tabelle "${table}": keine Zeilen\n`

  const columns = Object.keys(rows[0])
  const columnList = columns.map((c) => `"${c}"`).join(', ')
  const inserts = rows.map((row) => {
    const values = columns.map((col) => sqlLiteral(row[col]))
    return `INSERT INTO public.${table} (${columnList}) VALUES (${values.join(', ')});`
  })
  return `-- ${rows.length} Zeilen\n` + inserts.join('\n') + '\n'
}

export const adminDownloadBackup = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async () => {
    const supabase = getServiceSupabaseClient()

    const parts: string[] = []
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      parts.push(`--\n-- Daten: ${table}\n--\n${await dumpTable(supabase, table)}`)
    }
    for (const table of SEQUENCE_TABLES) {
      parts.push(`SELECT setval('public.${table}_id_seq', COALESCE((SELECT MAX(id) FROM public.${table}), 1));`)
    }

    const generatedAt = new Date().toISOString()
    const content =
      `-- Gaiser Dashboard – Datenbank-Backup\n` +
      `-- Erstellt: ${generatedAt}\n` +
      `--\n` +
      `-- Reiner Daten-Dump (INSERT-Statements). Zum Wiederherstellen zuerst das\n` +
      `-- Schema aus supabase/migrations/ auf eine leere Datenbank anwenden,\n` +
      `-- anschließend dieses Skript ausführen.\n\n` +
      `BEGIN;\n\n${parts.join('\n')}\nCOMMIT;\n`

    return { ok: true, filename: `gaiser-backup-${generatedAt.slice(0, 10)}.sql`, content } as const
  })
