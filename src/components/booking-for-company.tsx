import { ArrowDownToLine, ArrowUpFromLine, Clock, Truck } from 'lucide-react'
import { useState } from 'react'
import { WizardFlow } from './wizard-flow'
import { TruckWizardFlow } from './truck-wizard-flow'
import type { Company, FlowType } from '../state/app-state'

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
  const eyebrowColor = variant === 'pickup' ? 'text-amber-600' : variant === 'lkw' ? 'text-blue-600' : 'text-slate-600'
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

// Choose the kind of Vorgang for a given customer, then run the matching
// wizard. Shared by the admin and the employee (driver) "Neuer Vorgang".
export function BookingForCompany({
  company,
  vorgaengeTo,
}: {
  company: Company
  vorgaengeTo: string
}) {
  const [flowType, setFlowType] = useState<VorgangVariant | null>(null)

  if (flowType === 'lkw') {
    return (
      <section className="space-y-4">
        <TruckWizardFlow company={company} onExit={() => setFlowType(null)} vorgaengeTo={vorgaengeTo} />
      </section>
    )
  }

  if (flowType) {
    return (
      <section className="space-y-4">
        <WizardFlow flowType={flowType} company={company} onExit={() => setFlowType(null)} vorgaengeTo={vorgaengeTo} />
      </section>
    )
  }

  return (
    <div className="@container">
      <div className="grid gap-5 @5xl:grid-cols-3">
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
    </div>
  )
}
