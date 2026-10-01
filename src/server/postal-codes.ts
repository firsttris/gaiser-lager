import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

const lookupSchema = z.object({ postalCode: z.string().regex(/^\d{5}$/) })

type PostalCodeTable = Record<string, string[]>
let table: Promise<PostalCodeTable> | null = null

// German postal code → place names (GeoNames, CC BY 4.0; regenerate with
// scripts/update-postal-codes.mjs). Loaded on the server on first use only,
// so the ~0.5 MB table never reaches the browser bundle.
function loadTable() {
  table ??= import('./data/postal-codes-de.json').then((module) => module.default as PostalCodeTable)
  return table
}

// No session required: used on the public registration form as well.
export const lookupPostalCode = createServerFn({ method: 'GET' })
  .validator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }) => (await loadTable())[data.postalCode] ?? [])

export const postalCodeQueryOptions = (postalCode: string) =>
  queryOptions({
    queryKey: ['postal-code', postalCode] as const,
    queryFn: () => lookupPostalCode({ data: { postalCode } }),
    enabled: /^\d{5}$/.test(postalCode),
    staleTime: Infinity,
    refetchInterval: false,
  })
