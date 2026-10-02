import { History, MapPin } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { RecentBooking } from '../server/records'
import { AmountPadDialog, formatAmount } from './amount-dialog'
import { SitePickerDialog, sameSiteName } from './site-dialog'

// Building blocks shared by "Material holen/bringen" and "LKW-Stunden", so
// both bookings work the same on the kiosk: one tap for the usual case, the
// tablet keyboard only for a new construction site.

export function money(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value)
}

const QUICK_AMOUNT_COUNT = 5
const SITE_CHOICE_COUNT = 5

// The amounts booked most often, topped up with round defaults until the row
// is full, ascending.
export function buildQuickAmounts(history: number[], defaults: number[]) {
  const counts = new Map<number, number>()
  for (const amount of history) counts.set(amount, (counts.get(amount) ?? 0) + 1)
  const frequent = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, QUICK_AMOUNT_COUNT)
    .map(([amount]) => amount)
  for (const amount of defaults) {
    if (frequent.length >= QUICK_AMOUNT_COUNT) break
    if (!frequent.includes(amount)) frequent.push(amount)
  }
  return frequent.sort((a, b) => a - b)
}

// All of the company's sites, recently used first, then the rest by name.
// Recent bookings may name sites that were renamed or deleted since; only
// sites that still exist are offered.
export function orderSiteNames(recent: RecentBooking[], allSites: { name: string }[]) {
  const names: string[] = []
  const add = (name: string) => {
    if (!names.some((existing) => sameSiteName(existing, name))) names.push(name)
  }
  const existing = allSites.map((site) => site.name)
  for (const booking of recent) {
    const current = existing.find((name) => sameSiteName(name, booking.constructionSiteName))
    if (current) add(current)
  }
  for (const name of existing) add(name)
  return names
}

// Current spelling of a booked site, if it still exists.
export function currentSiteName(siteNames: string[], bookedName: string) {
  return siteNames.find((name) => sameSiteName(name, bookedName)) ?? bookedName
}

export function LastBookingButton({ booking, onApply }: { booking: RecentBooking; onApply: () => void }) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="flex w-full items-center gap-4 rounded-xl border-2 border-brand-600 bg-brand-50 px-5 py-4 text-left hover:bg-brand-100"
    >
      <History className="h-7 w-7 shrink-0 text-brand-700" strokeWidth={2.25} />
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-wider text-brand-700 uppercase">Wie zuletzt</span>
        <span className="block truncate text-lg font-semibold text-slate-900">
          {formatAmount(booking.amount)} {booking.unit} {booking.productName} · {booking.constructionSiteName}
        </span>
        <span className="block text-sm text-slate-600">{booking.createdAt}</span>
      </span>
    </button>
  )
}

const choiceClass = (isSelected: boolean) =>
  `rounded-xl border-2 transition ${
    isSelected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
  }`

// Tiles for picking one of a few named options (e.g. the trucks).
export function ChoiceButtons<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; title: string; detail?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`min-h-16 px-4 py-2.5 text-left ${choiceClass(option.value === value)}`}
          >
            <span className="block text-lg font-semibold">{option.title}</span>
            {option.detail && <span className="block text-sm font-medium text-slate-600">{option.detail}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// Quick amounts plus "Andere …", which opens the number pad. `value` is the
// amount as entered ("12.5"), '' for none.
export function QuickAmountPicker({
  label,
  unit,
  value,
  onChange,
  quickAmounts,
}: {
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  quickAmounts: number[]
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const parsed = Number(value)
  const isValid = value !== '' && Number.isFinite(parsed) && parsed > 0
  const isCustom = isValid && !quickAmounts.includes(parsed)

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">
        {label} ({unit})
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-6" role="group" aria-label={label}>
        {quickAmounts.map((amount) => {
          const isSelected = isValid && parsed === amount
          return (
            <button
              key={amount}
              type="button"
              onClick={() => onChange(String(amount))}
              aria-pressed={isSelected}
              className={`min-h-14 text-lg font-semibold tabular-nums ${choiceClass(isSelected)}`}
            >
              {formatAmount(amount)}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          aria-pressed={isCustom}
          className={`min-h-14 px-2 text-base font-semibold ${isCustom ? `${choiceClass(true)} tabular-nums` : `${choiceClass(false)} text-slate-700`}`}
        >
          {isCustom ? formatAmount(parsed) : 'Andere …'}
        </button>
      </div>
      <AmountPadDialog
        open={isDialogOpen}
        unit={unit}
        initialValue={value}
        onClose={() => setIsDialogOpen(false)}
        onApply={(next) => {
          onChange(next)
          setIsDialogOpen(false)
        }}
      />
    </div>
  )
}

// The most relevant sites as buttons plus "Andere Baustelle …" (search or
// create in a dialog). A chosen site that isn't among the buttons is shown as
// an extra, selected button so the choice is always visible in one place.
export function SitePicker({ siteNames, value, onChange }: { siteNames: string[]; value: string; onChange: (name: string) => void }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const trimmed = value.trim()
  const buttons = useMemo(() => {
    const names = siteNames.slice(0, SITE_CHOICE_COUNT)
    if (trimmed && !names.some((name) => sameSiteName(name, trimmed))) names.push(trimmed)
    return names
  }, [siteNames, trimmed])
  const isNew = trimmed.length > 0 && !siteNames.some((name) => sameSiteName(name, trimmed))

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">Baustelle</p>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Baustelle">
        {buttons.map((name) => {
          const isSelected = sameSiteName(name, trimmed)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-pressed={isSelected}
              className={`min-h-14 px-4 py-2.5 text-left text-base font-semibold break-words ${choiceClass(isSelected)}`}
            >
              {name}
              {isSelected && isNew && <span className="mt-0.5 block text-xs font-medium text-brand-700">Neu, wird mit dem Vorgang gespeichert</span>}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:border-slate-400"
        >
          <MapPin className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          {siteNames.length > 0 ? 'Andere Baustelle …' : 'Baustelle wählen …'}
        </button>
      </div>
      <SitePickerDialog
        open={isDialogOpen}
        siteNames={siteNames}
        onClose={() => setIsDialogOpen(false)}
        onPick={(name) => {
          onChange(name)
          setIsDialogOpen(false)
        }}
      />
    </div>
  )
}

// Replaces the former "Vorgang prüfen" step: what will be booked and the
// total, right above "Vorgang anlegen", as soon as there is an amount.
export function BookingSummary({
  headline,
  siteName,
  unitPriceText,
  total,
  emptyText,
}: {
  /** e.g. "12,5 t Rollkies"; null while no amount is chosen. */
  headline: string | null
  siteName: string
  unitPriceText: string
  total: number
  emptyText: ReactNode
}) {
  return (
    <div className={`rounded-xl p-4 ${headline ? 'bg-amber-50' : 'bg-slate-50'}`} aria-live="polite">
      {headline ? (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900">{headline}</p>
            <p className="text-slate-700">
              {siteName.trim() ? siteName.trim() : <span className="text-slate-500">Baustelle fehlt</span>} · {unitPriceText}
            </p>
          </div>
          <p className="text-2xl font-bold text-amber-800">
            {money(total)} <span className="text-sm font-semibold">netto</span>
          </p>
        </div>
      ) : (
        <p className="text-slate-700">{emptyText}</p>
      )}
    </div>
  )
}
