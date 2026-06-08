import { type PriceCategory } from '../state/app-state'

export function CompanyInput({
  label,
  value,
  onChange,
  placeholder,
  variant = 'default',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  variant?: 'default' | 'compact'
}) {
  let processedValue = value

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // Auto-formatting based on variant
    if (variant === 'compact') {
      // shortCode: uppercase, max 6 chars
      newValue = newValue.toUpperCase().slice(0, 6)
    }

    onChange(newValue)
  }

  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`mt-2 w-full border border-slate-300 ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      />
    </div>
  )
}

export function PinInput({
  label,
  value,
  onChange,
  variant = 'default',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  variant?: 'default' | 'compact'
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    onChange(newValue)
  }

  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={handleChange}
        inputMode="numeric"
        placeholder="1234"
        className={`mt-2 w-full border border-slate-300 ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      />
    </div>
  )
}

export function PriceCategorySelect({
  label,
  value,
  onChange,
  variant = 'default',
}: {
  label: string
  value: PriceCategory
  onChange: (value: PriceCategory) => void
  variant?: 'default' | 'compact'
}) {
  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PriceCategory)}
        className={`mt-2 w-full border border-slate-300 bg-white ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      >
        <option value="business">Unternehmen</option>
        <option value="private">Privat</option>
      </select>
    </div>
  )
}
