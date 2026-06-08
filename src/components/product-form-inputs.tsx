export function ProductNameInput({
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
  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full border border-slate-300 ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      />
    </div>
  )
}

export function ProductUnitInput({
  label,
  value,
  onChange,
  placeholder = 't',
  variant = 'default',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variant?: 'default' | 'compact'
}) {
  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full border border-slate-300 ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      />
    </div>
  )
}

export function ProductFlowSelect({
  label,
  value,
  onChange,
  variant = 'default',
}: {
  label: string
  value: 'pickup' | 'dropoff'
  onChange: (value: 'pickup' | 'dropoff') => void
  variant?: 'default' | 'compact'
}) {
  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'pickup' | 'dropoff')}
        className={`mt-2 w-full border border-slate-300 bg-white ${borderStyle} ${sizes} outline-none focus:border-slate-800`}
      >
        <option value="dropoff">Annahme</option>
        <option value="pickup">Verkauf</option>
      </select>
    </div>
  )
}

export function PriceField({
  value,
  onChange,
  placeholder,
  className = '',
  variant = 'default',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  variant?: 'default' | 'compact'
}) {
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'
  const padding = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className={`w-full border border-slate-300 ${borderStyle} ${padding} pr-8 outline-none focus:border-slate-800`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
        €
      </span>
    </div>
  )
}
