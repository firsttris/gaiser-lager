import { createFileRoute, Link } from '@tanstack/react-router'
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

  const pickupProducts = products.filter((p) => p.flow === 'pickup')
  const dropoffProducts = products.filter((p) => p.flow === 'dropoff')

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

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="mb-2 flex items-center gap-3">
            <Logo className="h-10" />
          </div>
          <h1 className="font-title text-4xl text-slate-900">Preisliste</h1>
          <p className="mt-2 text-slate-600">Alle verfügbaren Produkte und Dienstleistungen mit aktuellen Preisen.</p>

          {pickupProducts.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Anlieferungen</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Produkt</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Einheit</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Preis privat</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Preis Gewerbe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickupProducts.map((product, idx) => (
                      <tr key={product.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 text-slate-900">{product.name}</td>
                        <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-900">
                          {product.pickupPrivatePrice > 0 ? `€ ${product.pickupPrivatePrice.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900">
                          {product.pickupBusinessPrice > 0 ? `€ ${product.pickupBusinessPrice.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dropoffProducts.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Abfuhren</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Produkt</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Einheit</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Preis privat</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Preis Gewerbe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dropoffProducts.map((product, idx) => (
                      <tr key={product.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 text-slate-900">{product.name}</td>
                        <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-900">
                          {product.dropoffPrivatePrice > 0 ? `€ ${product.dropoffPrivatePrice.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900">
                          {product.dropoffBusinessPrice > 0 ? `€ ${product.dropoffBusinessPrice.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {products.length === 0 && (
            <div className="mt-8 rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-slate-600">Keine Produkte verfügbar.</p>
            </div>
          )}

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
