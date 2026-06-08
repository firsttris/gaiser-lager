import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { companies, login } = useAppState()
  const [query, setQuery] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const navigate = Route.useNavigate()

  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return []

    return companies.filter(
      (company) =>
        company.shortCode.toLowerCase().includes(value) ||
        company.name.toLowerCase().includes(value),
    )
  }, [companies, query])

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = login(selectedCompanyId ?? '', pin)
    if (!result.ok) {
      setError(result.message)
      return
    }

    setError('')
    void navigate({ to: '/wizard' })
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <TopNav />

      <section className="relative mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-amber-100 blur-3xl"></div>
        <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sky-100 blur-3xl"></div>

        <div className="relative grid gap-8 p-6 sm:grid-cols-2 sm:p-10">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase">
              Gaiser Baustoffe
            </p>
            <h1 className="font-title text-5xl leading-none text-slate-900 sm:text-6xl">
              Material
              <br />
              ohne Umwege.
            </h1>
            <p className="max-w-sm text-slate-600">
              Firma suchen, PIN eingeben, Vorgang anlegen. Komplett mobilfreundlich und ohne
              komplizierten Account-Prozess.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Demo-Hinweis</p>
              <p>Beispiel: KR fuer Kramfahrt, PIN 1234.</p>
            </div>
          </div>

          <form onSubmit={submitLogin} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="relative">
              <label className="text-sm font-semibold text-slate-700">Firma / Kuerzel</label>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedCompanyId(null)
                }}
                placeholder="z.B. KR oder Kramfahrt"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500"
              />

              {results.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {results.map((company) => (
                    <button
                      type="button"
                      key={company.id}
                      onClick={() => {
                        setSelectedCompanyId(company.id)
                        setQuery(`${company.shortCode} - ${company.name}`)
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        selectedCompanyId === company.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-semibold">{company.shortCode}</span> {company.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Firmen-PIN</label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="4-stellig"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500"
              />
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              In den Wizard starten
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
