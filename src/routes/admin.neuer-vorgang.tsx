import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { ArrowDownToLine, ArrowUpFromLine, Clock, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { WizardFlow } from '../components/wizard-flow'
import { TruckWizardFlow } from '../components/truck-wizard-flow'
import { useAppState, type FlowType } from '../state/app-state'

export const Route = createFileRoute('/admin/neuer-vorgang')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminNeuerVorgangPage,
})

type VorgangVariant = FlowType | 'lkw'

function FlowChoiceButton({
  variant,
  title,
  subtitle,
  onClick,
}: {
  variant: VorgangVariant
  title: string
  subtitle: string
  onClick: () => void
}) {
  const eyebrow = variant === 'pickup' ? 'Abholung' : variant === 'lkw' ? 'Leistung' : 'Annahme'
  const borderHover =
    variant === 'pickup' ? 'hover:border-amber-300' : variant === 'lkw' ? 'hover:border-blue-300' : 'hover:border-slate-300'
  const iconWrap =
    variant === 'pickup'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : variant === 'lkw'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-700'
  const eyebrowColor = variant === 'pickup' ? 'text-amber-600' : variant === 'lkw' ? 'text-blue-600' : 'text-slate-500'
  const arrowWrap =
    variant === 'pickup'
      ? 'bg-amber-50 text-amber-600'
      : variant === 'lkw'
        ? 'bg-blue-50 text-blue-600'
        : 'bg-slate-100 text-slate-600'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border border-slate-200 bg-white p-7 text-left no-underline shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 sm:p-8 ${borderHover}`}
    >
      <div className="flex min-h-32 items-center gap-5 sm:min-h-40 sm:gap-6">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border sm:h-18 sm:w-18 ${iconWrap}`}>
          <Truck className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.9} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold tracking-[0.18em] uppercase ${eyebrowColor}`}>{eyebrow}</p>
          <h3 className="font-title mt-2 text-4xl text-slate-900 sm:text-5xl">{title}</h3>
          <p className="mt-2 text-base text-slate-600">{subtitle}</p>
        </div>

        <div className={`hidden h-14 w-14 items-center justify-center rounded-full sm:flex ${arrowWrap}`}>
          {variant === 'pickup' ? (
            <ArrowDownToLine className="h-7 w-7" strokeWidth={2.2} />
          ) : variant === 'lkw' ? (
            <Clock className="h-7 w-7" strokeWidth={2.2} />
          ) : (
            <ArrowUpFromLine className="h-7 w-7" strokeWidth={2.2} />
          )}
        </div>
      </div>
    </button>
  )
}

function AdminNeuerVorgangPage() {
  const { companies } = useAppState()
  const [companyId, setCompanyId] = useState('')
  const [flowType, setFlowType] = useState<VorgangVariant | null>(null)

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [companies],
  )
  const selectedCompany = sortedCompanies.find((c) => c.id === companyId) ?? null

  if (selectedCompany && flowType) {
    if (flowType === 'lkw') {
      return (
        <section className="space-y-4">
          <TruckWizardFlow
            company={selectedCompany}
            onExit={() => setFlowType(null)}
            vorgaengeTo="/admin/vorgaenge"
          />
        </section>
      )
    }

    return (
      <section className="space-y-4">
        <WizardFlow
          flowType={flowType}
          company={selectedCompany}
          onExit={() => setFlowType(null)}
          vorgaengeTo="/admin/vorgaenge"
        />
      </section>
    )
  }

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

      {selectedCompany && (
        <div className="grid gap-5 md:grid-cols-3">
          <FlowChoiceButton
            variant="pickup"
            title="Material holen"
            subtitle="z.B. Betonrecycling abholen."
            onClick={() => setFlowType('pickup')}
          />
          <FlowChoiceButton
            variant="dropoff"
            title="Material bringen"
            subtitle="z.B. Aushub oder Bauschutt anliefern."
            onClick={() => setFlowType('dropoff')}
          />
          <FlowChoiceButton
            variant="lkw"
            title="LKW-Stunden"
            subtitle="z.B. Anlieferung mit LKW abrechnen."
            onClick={() => setFlowType('lkw')}
          />
        </div>
      )}
    </section>
  )
}
