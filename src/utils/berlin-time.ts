// The business runs on German time, but the app server (Vercel) runs in UTC.
// Every date that's shown, filtered by or embedded in a document number goes
// through these helpers so it never depends on the runtime's timezone.

export const BUSINESS_TIME_ZONE = 'Europe/Berlin'

export function formatBerlinDateTime(value: string | Date) {
  return new Date(value).toLocaleString('de-DE', { timeZone: BUSINESS_TIME_ZONE })
}

export function formatBerlinDate(value: string | Date) {
  return new Date(value).toLocaleDateString('de-DE', { timeZone: BUSINESS_TIME_ZONE })
}

export function berlinDateParts(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function berlinOffsetMs(instant: Date) {
  const p = berlinDateParts(instant)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

// 'YYYY-MM-DD' → the UTC instant at which that calendar day starts in Germany.
export function berlinDayStart(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day)
  const firstGuess = utcMidnight - berlinOffsetMs(new Date(utcMidnight))
  // Re-check with the offset at the guessed instant (handles DST switch days).
  return new Date(utcMidnight - berlinOffsetMs(new Date(firstGuess)))
}

// 'YYYY-MM-DD' → the UTC instant at which the *next* German calendar day starts
// (exclusive upper bound for "up to and including this day").
export function berlinDayEndExclusive(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return berlinDayStart(next.toISOString().slice(0, 10))
}

// Today's date in Germany as 'YYYY-MM-DD' (e.g. for export file names).
export function berlinIsoDate(value: Date = new Date()) {
  const p = berlinDateParts(value)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
