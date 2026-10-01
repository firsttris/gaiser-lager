import { describe, expect, it } from 'vitest'
import { berlinDayEndExclusive, berlinDayStart, berlinIsoDate, formatBerlinDate, formatBerlinDateTime } from './berlin-time'
import { formatGeneratedNumber } from './numbering-format'

describe('berlin-time', () => {
  it('formats UTC timestamps in German time (summer, UTC+2)', () => {
    expect(formatBerlinDateTime('2026-09-30T22:30:00Z')).toBe('1.10.2026, 00:30:00')
    expect(formatBerlinDate('2026-09-30T22:30:00Z')).toBe('1.10.2026')
  })

  it('formats UTC timestamps in German time (winter, UTC+1)', () => {
    expect(formatBerlinDateTime('2026-01-15T23:15:00Z')).toBe('16.1.2026, 00:15:00')
  })

  it('computes the UTC start of a German calendar day', () => {
    expect(berlinDayStart('2026-07-01').toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(berlinDayStart('2026-01-01').toISOString()).toBe('2025-12-31T23:00:00.000Z')
  })

  it('handles DST switch days', () => {
    // 29.03.2026: clocks jump forward at 02:00 — the day starts at UTC+1.
    expect(berlinDayStart('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(berlinDayEndExclusive('2026-03-29').toISOString()).toBe('2026-03-29T22:00:00.000Z')
    // 25.10.2026: clocks go back — the day starts at UTC+2 and ends at UTC+1.
    expect(berlinDayStart('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(berlinDayEndExclusive('2026-10-25').toISOString()).toBe('2026-10-25T23:00:00.000Z')
  })

  it('uses the German date for "today"', () => {
    expect(berlinIsoDate(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })
})

describe('formatGeneratedNumber', () => {
  it('uses the German calendar day for {TAG}', () => {
    expect(formatGeneratedNumber('LS-{JAHR}{MONAT}{TAG}-{NUMMER}', 7, 4, new Date('2026-09-30T23:30:00Z'))).toBe(
      'LS-20261001-0007',
    )
  })

  it('never truncates numbers longer than the padding', () => {
    expect(formatGeneratedNumber('{NUMMER}', 123456, 4)).toBe('123456')
  })
})
