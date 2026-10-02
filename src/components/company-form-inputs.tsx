export function CompanyInput({
  label,
  value,
  onChange,
  placeholder,
  variant = 'default',
  type = 'text',
  inputMode,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  variant?: 'default' | 'compact'
  type?: 'text' | 'email'
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
}) {
  const sizes = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const borderStyle = variant === 'compact' ? 'rounded-lg' : 'rounded-xl'

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
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
