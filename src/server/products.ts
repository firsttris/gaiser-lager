import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import type { ProductRow } from '#/lib/supabase/types'
import { parsePriceInput } from '#/utils/money'
import { RENAMEABLE_RECORD_STATUSES } from './record-snapshots'

const flowSchema = z.enum(['pickup', 'dropoff'])

const createProductSchema = z.object({
  name: z.string(),
  unit: z.string(),
  flow: flowSchema,
  price: z.string(),
})

const updateProductSchema = createProductSchema.extend({ id: z.number() })
const deleteProductSchema = z.object({ id: z.number() })

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
const PRODUCT_IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const uploadProductImageSchema = z.object({
  id: z.number(),
  fileBase64: z.string(),
  contentType: z.string(),
})
const removeProductImageSchema = z.object({ id: z.number() })

function productImageUrl(imagePath: string | null) {
  if (!imagePath) return null
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${imagePath}`
}

function decodeBase64Image(fileBase64: string) {
  const commaIndex = fileBase64.indexOf(',')
  const base64Data = commaIndex >= 0 ? fileBase64.slice(commaIndex + 1) : fileBase64
  return Buffer.from(base64Data, 'base64')
}

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    flow: row.flow,
    price: row.price,
    imageUrl: productImageUrl(row.image_path),
  }
}

export const listProducts = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAnySession()

  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true })
  if (error || !data) return []
  return data.map(toProduct)
})

export const adminCreateProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanedName = data.name.trim()
    const cleanedUnit = data.unit.trim()

    if (!cleanedName || !cleanedUnit) {
      return { ok: false, message: 'Bitte Produktname und Einheit ausfüllen.' } as const
    }

    const price = parsePriceInput(data.price)
    if (price === null) {
      return { ok: false, message: 'Der Preis muss eine gültige positive Zahl sein (z. B. 12,50).' } as const
    }

    const { error } = await context.supabase.from('products').insert({
      name: cleanedName,
      unit: cleanedUnit,
      flow: data.flow,
      price,
    })

    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht angelegt werden.' } as const
    }

    return { ok: true } as const
  })

export const adminUpdateProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentProduct } = await context.supabase
      .from('products')
      .select('name, flow')
      .eq('id', data.id)
      .maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const cleanedName = data.name.trim()
    const cleanedUnit = data.unit.trim()

    if (!cleanedName || !cleanedUnit) {
      return { ok: false, message: 'Bitte Produktname und Einheit ausfüllen.' } as const
    }

    const price = parsePriceInput(data.price)
    if (price === null) {
      return { ok: false, message: 'Der Preis muss eine gültige positive Zahl sein (z. B. 12,50).' } as const
    }

    const { error } = await context.supabase
      .from('products')
      .update({
        name: cleanedName,
        unit: cleanedUnit,
        flow: data.flow,
        price,
      })
      .eq('id', data.id)

    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht aktualisiert werden.' } as const
    }

    if (currentProduct.name !== cleanedName) {
      await context.supabase
        .from('records')
        .update({ product_name: cleanedName })
        .eq('type', currentProduct.flow)
        .eq('product_name', currentProduct.name)
        .in('status', RENAMEABLE_RECORD_STATUSES)
    }

    return { ok: true } as const
  })

export const adminDeleteProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => deleteProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentProduct } = await context.supabase
      .from('products')
      .select('name, flow, image_path')
      .eq('id', data.id)
      .maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const { count: historyCount } = await context.supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('type', currentProduct.flow)
      .eq('product_name', currentProduct.name)

    if (historyCount && historyCount > 0) {
      return {
        ok: false,
        message: 'Produkt kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
      } as const
    }

    const { count: flowCount } = await context.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('flow', currentProduct.flow)

    if (flowCount !== null && flowCount <= 1) {
      return { ok: false, message: 'Mindestens ein Produkt pro Typ muss vorhanden sein.' } as const
    }

    const { error } = await context.supabase.from('products').delete().eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht gelöscht werden.' } as const
    }

    if (currentProduct.image_path) {
      await context.supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([currentProduct.image_path])
    }

    return { ok: true } as const
  })

export const adminUploadProductImage = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => uploadProductImageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const extension = PRODUCT_IMAGE_EXTENSION_BY_MIME_TYPE[data.contentType]
    if (!extension) {
      return { ok: false, message: 'Nur JPG-, PNG- oder WebP-Bilder sind erlaubt.' } as const
    }

    const { data: currentProduct } = await context.supabase
      .from('products')
      .select('image_path')
      .eq('id', data.id)
      .maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const buffer = decodeBase64Image(data.fileBase64)
    if (buffer.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
      return { ok: false, message: 'Das Bild darf maximal 5 MB groß sein.' } as const
    }

    const path = `${data.id}-${Date.now()}.${extension}`

    const { error: uploadError } = await context.supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, buffer, { contentType: data.contentType, upsert: true })
    if (uploadError) {
      return { ok: false, message: 'Das Bild konnte nicht hochgeladen werden.' } as const
    }

    const { error: updateError } = await context.supabase.from('products').update({ image_path: path }).eq('id', data.id)
    if (updateError) {
      await context.supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
      return { ok: false, message: 'Das Bild konnte nicht gespeichert werden.' } as const
    }

    if (currentProduct.image_path && currentProduct.image_path !== path) {
      await context.supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([currentProduct.image_path])
    }

    return { ok: true, imageUrl: productImageUrl(path) } as const
  })

export const adminRemoveProductImage = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => removeProductImageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentProduct } = await context.supabase
      .from('products')
      .select('image_path')
      .eq('id', data.id)
      .maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const { error } = await context.supabase.from('products').update({ image_path: null }).eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Das Bild konnte nicht entfernt werden.' } as const
    }

    if (currentProduct.image_path) {
      await context.supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([currentProduct.image_path])
    }

    return { ok: true } as const
  })

export const productsQueryOptions = () =>
  queryOptions({
    queryKey: ['products'] as const,
    queryFn: () => listProducts(),
  })
