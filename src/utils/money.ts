export const VAT_RATE = 0.19

// Amounts are stored as double precision, so every computed amount is rounded
// to whole cents before it's stored or summed into a document total.
export function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Accepts German ("12,50") as well as English ("12.50") decimal input. An
// empty field counts as 0, like before.
export function parsePriceInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return 0
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return roundCents(Number(normalized))
}

export function parsePrices(privatePrice: string, businessPrice: string) {
  const parsedPrivatePrice = parsePriceInput(privatePrice)
  const parsedBusinessPrice = parsePriceInput(businessPrice)
  if (parsedPrivatePrice === null || parsedBusinessPrice === null) return null
  return { parsedPrivatePrice, parsedBusinessPrice }
}
