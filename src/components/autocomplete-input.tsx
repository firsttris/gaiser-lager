import { useMemo, useState } from 'react'

export type AutocompleteOption = {
  id: string
  label: string
  badge?: string
}

export function AutocompleteInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  sectionLabel = 'Vorschlaege',
  emptyStateText = 'Keine Treffer gefunden.',
  helperText,
  createHint,
  inputClassName = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 outline-none focus:border-slate-800',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: AutocompleteOption[]
  placeholder: string
  required?: boolean
  sectionLabel?: string
  emptyStateText?: string
  helperText?: string
  createHint?: string
  inputClassName?: string
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const normalizedQuery = value.trim().toLocaleLowerCase('de-DE')
  const filteredOptions = useMemo(
    () =>
      options
        .filter((option) => {
          if (!normalizedQuery) return true
          return option.label.toLocaleLowerCase('de-DE').includes(normalizedQuery)
        })
        .slice(0, 6),
    [normalizedQuery, options],
  )

  const hasExactMatch = useMemo(
    () => options.some((option) => option.label.toLocaleLowerCase('de-DE') === normalizedQuery),
    [normalizedQuery, options],
  )

  const showMenu = isMenuOpen && filteredOptions.length > 0
  const showEmptyState = isMenuOpen && filteredOptions.length === 0 && normalizedQuery.length > 0

  function selectOption(nextValue: string) {
    onChange(nextValue)
    setIsMenuOpen(false)
    setHighlightedIndex(0)
  }

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setIsMenuOpen(true)
          setHighlightedIndex(0)
        }}
        onFocus={() => setIsMenuOpen(true)}
        onBlur={(event) => {
          if (event.relatedTarget && event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
            return
          }

          setIsMenuOpen(false)
        }}
        onKeyDown={(event) => {
          if (!filteredOptions.length) {
            if (event.key === 'Escape') {
              setIsMenuOpen(false)
            }
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsMenuOpen(true)
            setHighlightedIndex((prev) => (prev >= filteredOptions.length - 1 ? 0 : prev + 1))
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setIsMenuOpen(true)
            setHighlightedIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1))
          }

          if (event.key === 'Enter' && isMenuOpen) {
            const highlightedOption = filteredOptions[highlightedIndex]
            if (highlightedOption) {
              event.preventDefault()
              selectOption(highlightedOption.label)
            }
          }

          if (event.key === 'Escape') {
            setIsMenuOpen(false)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={showMenu}
        aria-controls={`${label}-options`}
        required={required}
        className={inputClassName}
      />

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsMenuOpen((open) => !open)}
        className="absolute right-3 top-[2.6rem] inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={`${label} Vorschlaege anzeigen`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.7a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" />
        </svg>
      </button>

      {showMenu && (
        <div
          id={`${label}-options`}
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
            {sectionLabel}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.map((option, index) => {
              const isHighlighted = index === highlightedIndex

              return (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option.label)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                    isHighlighted ? 'bg-amber-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.badge && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                      {option.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showEmptyState && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
          {emptyStateText}
        </div>
      )}

      {helperText && <p className="mt-2 text-xs text-slate-500">{helperText}</p>}
      {!helperText && value.trim() && !hasExactMatch && createHint && (
        <p className="mt-2 text-xs text-slate-500">{createHint}</p>
      )}
    </div>
  )
}