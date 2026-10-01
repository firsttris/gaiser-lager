import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useMemo, useState } from 'react'
import { BookingForCompany } from '../components/booking-for-company'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/neuer-vorgang')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminNeuerVorgangPage,
})

function AdminNeuerVorgangPage() {
  const { companies } = useAppState()
  const [companyId, setCompanyId] = useState('')

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [companies],
  )
  const selectedCompany = sortedCompanies.find((c) => c.id === companyId) ?? null

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Neuer Vorgang</h2>
            <p className="mt-1 text-sm text-slate-600">Lege für einen Kunden einen neuen Vorgang an.</p>
          </div>
          <Link
            to="/admin/vorgaenge"
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
          >
            Zurück zu Vorgängen
          </Link>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-semibold text-slate-700">Kunde</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-slate-800 sm:max-w-sm"
          >
            <option value="">Bitte Kunde auswählen</option>
            {sortedCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </article>

      {selectedCompany && <BookingForCompany key={selectedCompany.id} company={selectedCompany} vorgaengeTo="/admin/vorgaenge" />}
    </section>
  )
}
