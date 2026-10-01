import type { PriceListProduct } from '../server/price-list'
import { money } from '../utils/history-utils'

function PriceTable({ title, products }: { title: string; products: PriceListProduct[] }) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Produkt</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Einheit</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Preis</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <tr key={product.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 text-slate-900">{product.name}</td>
                <td className="px-4 py-3 text-slate-700">{product.unit}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {product.price > 0 ? money(product.price) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// The public price list (one net price per product). Used on /preisliste and,
// from package 3 on, below the customer login.
export function PriceListTables({ products }: { products: PriceListProduct[] }) {
  const pickupProducts = products.filter((p) => p.flow === 'pickup')
  const dropoffProducts = products.filter((p) => p.flow === 'dropoff')

  if (products.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center">
        <p className="text-slate-700">Keine Produkte verfügbar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* pickup = the customer collects material from Gaiser (Verkauf),
          dropoff = the customer delivers material to Gaiser (Annahme). */}
      {pickupProducts.length > 0 && <PriceTable title="Verkauf (Abholung)" products={pickupProducts} />}
      {dropoffProducts.length > 0 && <PriceTable title="Annahme (Anlieferung)" products={dropoffProducts} />}
      <p className="text-sm text-slate-700">Alle Preise netto, zzgl. 19 % USt.</p>
    </div>
  )
}
