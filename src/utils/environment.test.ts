import { describe, expect, it } from 'vitest'
import { isLocalSupabaseUrl } from './environment'

describe('isLocalSupabaseUrl', () => {
  it('recognizes the local Supabase', () => {
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true)
    expect(isLocalSupabaseUrl('http://[::1]:54321')).toBe(true)
  })

  it('treats everything else as remote', () => {
    expect(isLocalSupabaseUrl('https://abcdefgh.supabase.co')).toBe(false)
    expect(isLocalSupabaseUrl('https://127.0.0.1.evil.example')).toBe(false)
    expect(isLocalSupabaseUrl('')).toBe(false)
    expect(isLocalSupabaseUrl(undefined)).toBe(false)
    expect(isLocalSupabaseUrl('not a url')).toBe(false)
  })
})
