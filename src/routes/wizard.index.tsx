import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowDownToLine, ArrowUpFromLine, Truck } from 'lucide-react'
import type { FlowType } from '../state/app-state'

export const Route = createFileRoute('/wizard/')({ component: WizardIndexPage })

function FlowChoiceCard({
  type,
  title,
  subtitle,
  to,
}: {
  type: FlowType
  title: string
  subtitle: string
  to: '/wizard/pickup' | '/wizard/dropoff'
}) {
  const isPickup = type === 'pickup'

  return (
    <Link
      to={to}
      className={`rounded-3xl border p-7 text-left no-underline shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 sm:p-8 ${
        isPickup
          ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
          : 'border-sky-200 bg-sky-50 hover:border-sky-300'
      }`}
    >
      <div className="flex min-h-46 items-center gap-5 sm:min-h-52 sm:gap-6">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border sm:h-18 sm:w-18 ${
            isPickup ? 'border-amber-200 bg-white text-amber-700' : 'border-sky-200 bg-white text-sky-700'
          }`}
        >
          <Truck className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.9} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
            {isPickup ? 'Abholung' : 'Annahme'}
          </p>
          <h3 className="font-title mt-2 text-5xl text-slate-900 sm:text-6xl">{title}</h3>
          <p className="mt-2 text-base text-slate-600 sm:text-lg">{subtitle}</p>
        </div>

        <div
          className={`hidden h-14 w-14 items-center justify-center rounded-full sm:flex ${
            isPickup ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {isPickup ? (
            <ArrowDownToLine className="h-7 w-7" strokeWidth={2.2} />
          ) : (
            <ArrowUpFromLine className="h-7 w-7" strokeWidth={2.2} />
          )}
        </div>
      </div>
    </Link>
  )
}

function WizardIndexPage() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <FlowChoiceCard
        type="pickup"
        title="Material holen"
        subtitle="z.B. Betonrecycling abholen."
        to="/wizard/pickup"
      />
      <FlowChoiceCard
        type="dropoff"
        title="Material bringen"
        subtitle="z.B. Aushub oder Bauschutt anliefern."
        to="/wizard/dropoff"
      />
    </div>
  )
}
