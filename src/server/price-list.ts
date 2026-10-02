import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import type { ProductRow } from '#/lib/supabase/types'

export type PriceListProduct = {
  id: number
  name: string
  unit: string
  flow: 'pickup' | 'dropoff'
  price: number
}

function toProduct(row: ProductRow): PriceListProduct {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    flow: row.flow,
    price: row.price,
  }
}

// Public function — no authentication required
export const getPublicPriceList = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true })

  if (error || !data) return []
  return data.map(toProduct)
})

export const publicPriceListQueryOptions = () =>
  queryOptions({
    queryKey: ['price-list', 'public'] as const,
    queryFn: () => getPublicPriceList(),
  })
