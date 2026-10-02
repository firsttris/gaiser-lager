import { describe, expect, it } from 'vitest'
import { parsePriceInput, roundCents } from './money'

describe('roundCents', () => {
  it('removes floating point noise', () => {
    expect(1.15 * 100).not.toBe(115)
    expect(roundCents(1.15 * 100)).toBe(115)
  })

  it('rounds half up to whole cents', () => {
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(19 * 0.19)).toBe(3.61)
  })
})

describe('parsePriceInput', () => {
  it('accepts German and English decimals', () => {
    expect(parsePriceInput('12,50')).toBe(12.5)
    expect(parsePriceInput('12.50')).toBe(12.5)
    expect(parsePriceInput(' 8 ')).toBe(8)
  })

  it('treats an empty field as 0', () => {
    expect(parsePriceInput('')).toBe(0)
  })

  it('rejects invalid or negative input', () => {
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('-5')).toBeNull()
    expect(parsePriceInput('1,2,3')).toBeNull()
  })
})
