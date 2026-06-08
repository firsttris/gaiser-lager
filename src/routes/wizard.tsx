import { Outlet, createFileRoute, Link } from '@tanstack/react-router'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/wizard')({ component: WizardLayout })

function WizardLayout() {
  const { isLoggedIn } = useAppState()

  if (!isLoggedIn) {
    return (
      <PageShell>
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Der Wizard ist nur nach Firmen-PIN verfuegbar.</p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            Zum Login
          </Link>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <TopNav />
      <section className="space-y-4">
        <Outlet />
      </section>
    </PageShell>
  )
}
