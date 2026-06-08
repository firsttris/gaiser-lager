import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({ component: AdminIndexPage })

function AdminIndexPage() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Admin-Bereich</h2>
      <p className="mt-2 text-sm text-slate-600">
        Bitte waehle einen Bereich: Produkte pflegen oder Firmen pflegen.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/admin/products"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-black"
        >
          Zu Produkte pflegen
        </Link>
        <Link
          to="/admin/companies"
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-200"
        >
          Zu Firmen pflegen
        </Link>
      </div>
    </section>
  )
}
