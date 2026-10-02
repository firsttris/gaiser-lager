import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { COMPANY_SEARCH_MIN_CHARS, searchCompanies } from '../server/companies'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { Spinner } from './spinner'

export type CompanySearchResult = { id: string; name: string }

// Company picker for the customer login. Searches server-side and only from
// COMPANY_SEARCH_MIN_CHARS characters on, so the customer list can't be
// browsed. The list opens while typing (not only on focus), so it also comes
// back after a company was picked and the text is edited again.
export function CompanySearchInput({
  onSelect,
}: {
  onSelect: (company: CompanySearchResult | null) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const trimmed = query.trim()
  const debouncedQuery = useDebouncedValue(trimmed, 250)
  const hasEnoughChars = trimmed.length >= COMPANY_SEARCH_MIN_CHARS

  const searchQuery = useQuery({
    queryKey: ['company-search', debouncedQuery] as const,
    queryFn: () => searchCompanies({ data: { query: debouncedQuery } }),
    enabled: debouncedQuery.length >= COMPANY_SEARCH_MIN_CHARS,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: false,
  })
  const results = hasEnoughChars ? (searchQuery.data ?? []) : []
  const isSearching = hasEnoughChars && (searchQuery.isFetching || debouncedQuery !== trimmed)
  const showList = isOpen && selectedId === null && hasEnoughChars

  function select(company: CompanySearchResult) {
    setSelectedId(company.id)
    setQuery(company.name)
    setIsOpen(false)
    onSelect(company)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((index) => (results.length ? (index + 1) % results.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0))
    } else if (event.key === 'Enter' && results[highlightedIndex]) {
      event.preventDefault()
      select(results[highlightedIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-slate-700" htmlFor={`${listId}-input`}>
        Firma
      </label>
      <input
        id={`${listId}-input`}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setSelectedId(null)
          setIsOpen(true)
          setHighlightedIndex(0)
          onSelect(null)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={`Firmenname eingeben (ab ${COMPANY_SEARCH_MIN_CHARS} Buchstaben)`}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg text-slate-900 outline-none transition focus:border-amber-500"
      />

      {showList && (
        <div
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          {results.map((company, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              key={company.id}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(company)}
              className={`w-full rounded-lg px-4 py-3 text-left text-lg font-semibold transition ${
                index === highlightedIndex ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              {company.name}
            </button>
          ))}
          {results.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
              {isSearching ? (
                <>
                  <Spinner className="h-4 w-4" /> Suche …
                </>
              ) : (
                'Keine Firma gefunden.'
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
