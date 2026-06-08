import { createFileRoute } from '@tanstack/react-router'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/products')({ component: AdminProductsPage })

function PriceField({
  value,
  onChange,
  className = '',
}: {
  value: number
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
        €
      </span>
    </div>
  )
}

function AdminProductsPage() {
  const { products, updateProduct } = useAppState()
  const dropoffProducts = products.filter((product) => product.flow === 'dropoff')
  const pickupProducts = products.filter((product) => product.flow === 'pickup')

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-5xl text-slate-900">Produkte</h2>

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="font-title text-3xl text-slate-900">Annahme</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Kundenanlieferungen.</p>

          <div className="mt-3 space-y-3 md:hidden">
            {dropoffProducts.map((product) => (
              <article key={product.id} className="rounded-xl border border-slate-200 p-4">
                <label className="text-xs font-semibold text-slate-600">Material</label>
                <input
                  value={product.name}
                  onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Einheit</label>
                    <input
                      value={product.unit}
                      onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Preis Privat (€)</label>
                    <PriceField
                      value={product.dropoffPrivatePrice}
                      onChange={(value) => updateProduct(product.id, 'dropoffPrivatePrice', value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Preis Unternehmen (€)</label>
                    <PriceField
                      value={product.dropoffBusinessPrice}
                      onChange={(value) => updateProduct(product.id, 'dropoffBusinessPrice', value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Einheit</th>
                  <th className="px-3 py-2">Preis Privat (€)</th>
                  <th className="px-3 py-2">Preis Unternehmen (€)</th>
                </tr>
              </thead>
              <tbody>
                {dropoffProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={product.unit}
                        onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PriceField
                        value={product.dropoffPrivatePrice}
                        onChange={(value) => updateProduct(product.id, 'dropoffPrivatePrice', value)}
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PriceField
                        value={product.dropoffBusinessPrice}
                        onChange={(value) => updateProduct(product.id, 'dropoffBusinessPrice', value)}
                        className="w-28"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-title text-3xl text-slate-900">Verkauf</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Materialabholung durch den Kunden.</p>

          <div className="mt-3 space-y-3 md:hidden">
            {pickupProducts.map((product) => (
              <article key={product.id} className="rounded-xl border border-slate-200 p-4">
                <label className="text-xs font-semibold text-slate-600">Material</label>
                <input
                  value={product.name}
                  onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Einheit</label>
                    <input
                      value={product.unit}
                      onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Preis Privat (€)</label>
                    <PriceField
                      value={product.pickupPrivatePrice}
                      onChange={(value) => updateProduct(product.id, 'pickupPrivatePrice', value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Preis Unternehmen (€)</label>
                    <PriceField
                      value={product.pickupBusinessPrice}
                      onChange={(value) => updateProduct(product.id, 'pickupBusinessPrice', value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Einheit</th>
                  <th className="px-3 py-2">Preis Privat (€)</th>
                  <th className="px-3 py-2">Preis Unternehmen (€)</th>
                </tr>
              </thead>
              <tbody>
                {pickupProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={product.unit}
                        onChange={(event) => updateProduct(product.id, 'unit', event.target.value)}
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PriceField
                        value={product.pickupPrivatePrice}
                        onChange={(value) => updateProduct(product.id, 'pickupPrivatePrice', value)}
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <PriceField
                        value={product.pickupBusinessPrice}
                        onChange={(value) => updateProduct(product.id, 'pickupBusinessPrice', value)}
                        className="w-28"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
