import { createFileRoute, Link } from '@tanstack/react-router'
import { PriceListTables } from '../components/price-list-tables'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { publicPriceListQueryOptions } from '../server/price-list'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'

export const Route = createFileRoute('/preisliste')({
  component: PriceListPage,
})

function PriceListPage() {
  const { data: products = [], isLoading } = useQuery(publicPriceListQueryOptions())

  if (isLoading) {
    return (
      <PageShell>
        <TopNav />
        <div className="flex h-96 items-center justify-center">
          <Spinner className="h-8 w-8 text-slate-400" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <TopNav />

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Login
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
          <div className="mb-2 flex items-center gap-3">
            <Logo className="h-10" />
          </div>
          <h1 className="font-title text-4xl text-slate-900">Preisliste</h1>
          <p className="mt-2 text-slate-600">Alle verfügbaren Produkte und Dienstleistungen mit aktuellen Preisen.</p>

          <div className="mt-8">
            <PriceListTables products={products} />
          </div>

          <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
            <p>
              <strong>Hinweis:</strong> Die Preisliste wird automatisch aus der Produktdatenbank generiert. Für
              konkrete Angebote und Buchungen melden Sie sich bitte mit Ihrer Firma an.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
