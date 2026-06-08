import { createFileRoute } from '@tanstack/react-router'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/products')({ component: AdminProductsPage })

function AdminProductsPage() {
  const { products, updateProduct } = useAppState()
  const dropoffProducts = products.filter((product) => product.flow === 'dropoff')
  const pickupProducts = products.filter((product) => product.flow === 'pickup')

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-5xl text-slate-900">Produkte</h2>
      <p className="mt-2 text-sm text-slate-600">
        Reiner Prototyp ohne API. Werte werden nur lokal im Browser gespeichert.
      </p>

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="font-title text-3xl text-slate-900">Annahme (Material bringen)</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Kundenanlieferungen.</p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Einheit</th>
                  <th className="px-3 py-2">Preis bringen</th>
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
                      <input
                        value={product.dropoffPrice}
                        onChange={(event) => updateProduct(product.id, 'dropoffPrice', event.target.value)}
                        inputMode="decimal"
                        className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-title text-3xl text-slate-900">Verkauf (Material holen)</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Materialabholung durch den Kunden.</p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Einheit</th>
                  <th className="px-3 py-2">Preis holen</th>
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
                      <input
                        value={product.pickupPrice}
                        onChange={(event) => updateProduct(product.id, 'pickupPrice', event.target.value)}
                        inputMode="decimal"
                        className="w-28 rounded-lg border border-slate-300 px-3 py-2"
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
