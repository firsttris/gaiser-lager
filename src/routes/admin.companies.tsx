import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/companies')({ component: AdminCompaniesPage })

function AdminCompaniesPage() {
  const { companies, createCompany } = useAppState()
  const [shortCode, setShortCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [pin, setPin] = useState('')
  const [companyError, setCompanyError] = useState('')
  const [companySuccess, setCompanySuccess] = useState('')

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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Firmen</h2>
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
            placeholder="z.B. Krampfert Wohnbau GmbH"
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

      <div className="mt-5 space-y-3 md:hidden">
        {companies.map((company) => (
          <article key={company.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Kuerzel</p>
            <p className="text-sm font-semibold text-slate-900">{company.shortCode}</p>

            <p className="mt-3 text-xs text-slate-500">Firma</p>
            <p className="text-sm text-slate-800">{company.name}</p>

            <p className="mt-3 text-xs text-slate-500">PIN</p>
            <p className="text-sm font-semibold text-slate-800">{company.pin}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 hidden overflow-x-auto md:block">
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
  )
}
