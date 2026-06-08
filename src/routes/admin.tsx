import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin')({ component: AdminPage })

function AdminPage() {
  const { isAdminLoggedIn, adminLogin, adminLogout, products, updateProduct, companies, createCompany } = useAppState()
  const dropoffProducts = products.filter((product) => product.flow === 'dropoff')
  const pickupProducts = products.filter((product) => product.flow === 'pickup')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [pin, setPin] = useState('')
  const [companyError, setCompanyError] = useState('')
  const [companySuccess, setCompanySuccess] = useState('')

  function submitAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = adminLogin(password)
    if (!result.ok) {
      setAuthError(result.message)
      return
    }

    setAuthError('')
    setPassword('')
  }

  function submitCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = createCompany({
      shortCode,
      name: companyName,
      pin,
    })

    if (!result.ok) {
      setCompanySuccess('')
      setCompanyError(result.message)
      return
    }

    setCompanyError('')
    setCompanySuccess(`Firma ${shortCode.trim().toUpperCase()} wurde angelegt.`)
    setShortCode('')
    setCompanyName('')
    setPin('')
  }

  if (!isAdminLoggedIn) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="absolute -right-28 -top-24 h-56 w-56 rounded-full bg-rose-100 blur-3xl"></div>
          <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-cyan-100 blur-3xl"></div>

          <div className="relative grid gap-8 sm:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-white uppercase">
                Admin
              </p>
              <h1 className="font-title mt-3 text-5xl text-slate-900">Gaiser Verwaltung</h1>
              <p className="mt-3 text-slate-600">
                Geschuetzter Bereich fuer Produktpflege und Firmenanlage.
              </p>
              <p className="mt-4 text-sm text-slate-500">Initiales Passwort fuer Demo: admin</p>
            </div>

            <form onSubmit={submitAdminLogin} className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="text-sm font-semibold text-slate-700">Admin-Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort eingeben"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
              />

              {authError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{authError}</p>}

              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                Als Admin anmelden
              </button>

              <Link
                to="/"
                className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
              >
                Zurueck zur Startseite
              </Link>
            </form>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Admin Bereich</p>
          <h1 className="font-title text-5xl text-slate-900">Gaiser Verwaltung</h1>
        </div>
        <div className="mt-3 flex gap-2 sm:mt-0">
          <Link
            to="/"
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
          >
            Zur Startseite
          </Link>
          <button
            type="button"
            onClick={adminLogout}
            className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200"
          >
            Admin abmelden
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h1 className="font-title text-5xl text-slate-900">Admin: Produkte pflegen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reiner Prototyp ohne API. Werte werden nur lokal im Browser gespeichert.
        </p>

        <div className="mt-6 space-y-8">
          <div>
            <h2 className="font-title text-3xl text-slate-900">Annahme (Material bringen)</h2>
            <p className="mt-1 text-sm text-slate-600">Produkte fuer Kundenanlieferungen.</p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-3xl border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Einheit</th>
                    <th className="px-3 py-2">Preis bringen</th>
                  </tr>
                </thead>
                <tbody>
                  {dropoffProducts.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          value={product.name}
                          onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={product.unit}
                          onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                          className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={product.dropoffPrice}
                          onChange={(event) =>
                            updateProduct(product.id, 'dropoffPrice', event.target.value)
                          }
                          inputMode="decimal"
                          className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-title text-3xl text-slate-900">Verkauf (Material holen)</h2>
            <p className="mt-1 text-sm text-slate-600">Produkte fuer Materialabholung durch den Kunden.</p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-3xl border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Einheit</th>
                    <th className="px-3 py-2">Preis holen</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupProducts.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          value={product.name}
                          onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={product.unit}
                          onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                          className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={product.pickupPrice}
                          onChange={(event) =>
                            updateProduct(product.id, 'pickupPrice', event.target.value)
                          }
                          inputMode="decimal"
                          className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h2 className="font-title text-4xl text-slate-900">Firmen anlegen</h2>
        <p className="mt-2 text-sm text-slate-600">Neue Firmen koennen hier direkt fuer den Login angelegt werden.</p>

        <form onSubmit={submitCompany} className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Kuerzel</label>
            <input
              value={shortCode}
              onChange={(event) => setShortCode(event.target.value.toUpperCase().slice(0, 6))}
              placeholder="z.B. KR"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Firmenname</label>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="z.B. Kramfahrt GmbH"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">PIN (4-stellig)</label>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="1234"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
            />
          </div>

          <div className="md:col-span-4">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Firma anlegen
            </button>
          </div>
        </form>

        {companyError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{companyError}</p>}
        {companySuccess && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{companySuccess}</p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2">Kuerzel</th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">PIN</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{company.shortCode}</td>
                  <td className="px-3 py-2">{company.name}</td>
                  <td className="px-3 py-2">{company.pin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
