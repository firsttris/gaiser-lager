import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_RESULTS = 8

// Matches the server (findOrCreateConstructionSite): names are trimmed,
// inner whitespace collapsed and compared without case.
export function normalizeSiteName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}
export function sameSiteName(a: string, b: string) {
  return normalizeSiteName(a).toLocaleLowerCase('de-DE') === normalizeSiteName(b).toLocaleLowerCase('de-DE')
}

// Pick any of the company's construction sites or create a new one. The only
// place in "Neuer Vorgang" where the tablet keyboard opens, and only to search
// or type a new address.
export function SitePickerDialog({
  open,
  siteNames,
  onClose,
  onPick,
}: {
  open: boolean
  /** All of the company's sites, most relevant first. */
  siteNames: string[]
  onClose: () => void
  onPick: (name: string) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const typed = normalizeSiteName(query)
  const needle = typed.toLocaleLowerCase('de-DE')
  const matches = siteNames.filter((name) => name.toLocaleLowerCase('de-DE').includes(needle)).slice(0, MAX_RESULTS)
  const exactMatch = typed ? siteNames.find((name) => sameSiteName(name, typed)) : undefined
  const canCreate = typed.length > 0 && !exactMatch

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div role="dialog" aria-modal="true" aria-label="Baustelle wählen" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-title text-2xl text-slate-900">Baustelle wählen</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Abbrechen
          </button>
        </div>

        <form
          className="relative mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (exactMatch) onPick(exactMatch)
            else if (canCreate) onPick(typed)
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            autoComplete="off"
            aria-label="Baustelle suchen oder neu eingeben"
            placeholder={siteNames.length ? 'Suchen oder neue Adresse eingeben' : 'Adresse der Baustelle, z.B. Nordring 12, Berlin'}
            className="w-full rounded-xl border border-slate-300 py-4 pr-4 pl-12 text-lg outline-none focus:border-brand-600"
          />
        </form>

        <div className="mt-4 grid gap-2.5" role="listbox" aria-label="Baustellen">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={exactMatch === name}
              onClick={() => onPick(name)}
              className="min-h-14 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold break-words text-slate-900 hover:border-slate-300"
            >
              {name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => onPick(typed)}
              className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-dashed border-brand-600 bg-brand-50 px-4 py-3 text-left text-base font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} />
              <span className="break-words">„{typed}“ als neue Baustelle anlegen</span>
            </button>
          )}
          {!typed && siteNames.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Noch keine Baustellen gespeichert. Adresse eingeben, sie wird mit dem Vorgang gespeichert.</p>
          )}
          {typed && matches.length === 0 && !canCreate && (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Keine Baustelle gefunden.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
