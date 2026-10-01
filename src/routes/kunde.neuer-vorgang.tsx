import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'

export const Route = createFileRoute('/kunde/neuer-vorgang')({ component: WizardLayout })

function WizardLayout() {
  return (
    <PageShell>
      <TopNav />
      <section className="space-y-4">
        <Outlet />
      </section>
    </PageShell>
  )
}
