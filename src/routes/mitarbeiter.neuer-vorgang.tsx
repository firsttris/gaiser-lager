import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CompanySearchInput } from '../components/company-search-input'
import { BookingForCompany } from '../components/booking-for-company'
import { Spinner } from '../components/spinner'
import { getCompanyForBooking } from '../server/companies'

export const Route = createFileRoute('/mitarbeiter/neuer-vorgang')({ component: EmployeeNewRecordPage })

// Drivers book on behalf of a customer: search the customer (no full list),
// then the same three choices and wizards as everywhere else.
function EmployeeNewRecordPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const companyQuery = useQuery({
    queryKey: ['company-for-booking', companyId] as const,
    queryFn: () => getCompanyForBooking({ data: { id: companyId! } }),
    enabled: companyId !== null,
    refetchInterval: false,
  })
  const company = companyQuery.data ?? null

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <h2 className="font-title text-4xl text-slate-900">Neuer Vorgang</h2>
        <p className="mt-1 text-slate-700">Für welchen Kunden?</p>
        <div className="mt-4 max-w-2xl">
          <CompanySearchInput onSelect={(selected) => setCompanyId(selected?.id ?? null)} />
        </div>
        {companyQuery.isFetching && (
          <div className="mt-4">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        )}
      </article>

      {company && <BookingForCompany key={company.id} company={company} vorgaengeTo="/mitarbeiter/buchungen" />}
    </section>
  )
}
