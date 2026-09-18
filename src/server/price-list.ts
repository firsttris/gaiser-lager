import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import type { ProductRow } from '#/lib/supabase/types'

export type PriceListProduct = {
  id: number
  name: string
  unit: string
  flow: 'pickup' | 'dropoff'
  pickupPrivatePrice: number
  pickupBusinessPrice: number
  dropoffPrivatePrice: number
  dropoffBusinessPrice: number
}

function toProduct(row: ProductRow): PriceListProduct {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    flow: row.flow,
    pickupPrivatePrice: row.pickup_private_price,
    pickupBusinessPrice: row.pickup_business_price,
    dropoffPrivatePrice: row.dropoff_private_price,
    dropoffBusinessPrice: row.dropoff_business_price,
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
