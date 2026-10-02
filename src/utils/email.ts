// Quick client-side check for a friendlier message; the server validates
// again with zod (companyEmailSchema).
export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
