import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState } from '../state/app-state'
import { useProductForm } from '../hooks/use-product-form'
import { ProductNameInput, ProductUnitInput, ProductFlowSelect, PriceField } from '../components/product-form-inputs'

export const Route = createFileRoute('/admin/products')({ component: AdminProductsPage })

function AdminProductsPage() {
  const { products, createProduct, updateProduct, deleteProduct } = useAppState()
  const createForm = useProductForm()
  const editForm = useProductForm()
  const [editingProductId, setEditingProductId] = useState<number | null>(null)

  const dropoffProducts = products.filter((product) => product.flow === 'dropoff')
  const pickupProducts = products.filter((product) => product.flow === 'pickup')

  function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = createProduct({
      name: createForm.formState.name,
      unit: createForm.formState.unit,
      flow: createForm.formState.flow,
      privatePrice: createForm.formState.privatePrice,
      businessPrice: createForm.formState.businessPrice,
    })

    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    createForm.setMessage(`Produkt ${createForm.formState.name.trim()} wurde angelegt.`, 'success')
    createForm.reset()
  }

  function cancelEdit() {
    setEditingProductId(null)
    editForm.reset()
  }

  function startEditProduct(productId: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    setEditingProductId(product.id)
    editForm.update({
      name: product.name,
      unit: product.unit,
      flow: product.flow,
      privatePrice: String(product.flow === 'pickup' ? product.pickupPrivatePrice : product.dropoffPrivatePrice),
      businessPrice: String(product.flow === 'pickup' ? product.pickupBusinessPrice : product.dropoffBusinessPrice),
    })
  }

  function saveEditedProduct(productId: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    const result = updateProduct({
      id: product.id,
      name: editForm.formState.name,
      unit: editForm.formState.unit,
      flow: product.flow,
      privatePrice: editForm.formState.privatePrice,
      businessPrice: editForm.formState.businessPrice,
    })

    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    editForm.setMessage(`Produkt ${editForm.formState.name.trim()} wurde aktualisiert.`, 'success')
    cancelEdit()
  }

  function removeProduct(productId: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    if (!window.confirm(`Produkt ${product.name} wirklich loeschen?`)) {
      return
    }

    const result = deleteProduct({ id: productId })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    if (editingProductId === productId) cancelEdit()

    editForm.setMessage(`Produkt ${product.name} wurde geloescht.`, 'success')
  }

  function ProductCards({ type }: { type: 'dropoff' | 'pickup' }) {
    const items = type === 'dropoff' ? dropoffProducts : pickupProducts

    return (
      <div className="mt-3 space-y-3 md:hidden">
        {items.map((product) => (
          <article key={product.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Material</p>
            {editingProductId === product.id ? (
              <input
                value={editForm.formState.name}
                onChange={(event) => editForm.update({ name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Einheit</p>
                {editingProductId === product.id ? (
                  <input
                    value={editForm.formState.unit}
                    onChange={(event) => editForm.update({ unit: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="font-semibold text-slate-800">{product.unit}</p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Preis Privat</p>
                {editingProductId === product.id ? (
                  <PriceField value={editForm.formState.privatePrice} onChange={(val) => editForm.update({ privatePrice: val })} variant="compact" className="mt-1" />
                ) : (
                  <p className="font-semibold text-slate-800">
                    {type === 'dropoff' ? product.dropoffPrivatePrice : product.pickupPrivatePrice} €
                  </p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Preis Unternehmen</p>
                {editingProductId === product.id ? (
                  <PriceField value={editForm.formState.businessPrice} onChange={(val) => editForm.update({ businessPrice: val })} variant="compact" className="mt-1" />
                ) : (
                  <p className="font-semibold text-slate-800">
                    {type === 'dropoff' ? product.dropoffBusinessPrice : product.pickupBusinessPrice} €
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {editingProductId === product.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveEditedProduct(product.id)}
                    className="min-w-24 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEditProduct(product.id)}
                    className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="min-w-24 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Loeschen
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    )
  }

  function ProductTable({ type }: { type: 'dropoff' | 'pickup' }) {
    const items = type === 'dropoff' ? dropoffProducts : pickupProducts

    return (
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-3xl table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-[38%] px-3 py-2">Material</th>
              <th className="w-24 px-3 py-2">Einheit</th>
              <th className="w-40 px-3 py-2">Preis Privat (€)</th>
              <th className="w-44 px-3 py-2">Preis Unternehmen (€)</th>
              <th className="w-56 px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2">
                  {editingProductId === product.id ? (
                    <input
                      value={editForm.formState.name}
                      onChange={(event) => editForm.update({ name: event.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="flex h-10 items-center truncate">{product.name}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingProductId === product.id ? (
                    <input
                      value={editForm.formState.unit}
                      onChange={(event) => editForm.update({ unit: event.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="flex h-10 items-center">{product.unit}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingProductId === product.id ? (
                    <PriceField value={editForm.formState.privatePrice} onChange={(val) => editForm.update({ privatePrice: val })} variant="compact" className="w-full" />
                  ) : (
                    <p className="flex h-10 items-center">
                      {type === 'dropoff' ? product.dropoffPrivatePrice : product.pickupPrivatePrice}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingProductId === product.id ? (
                    <PriceField value={editForm.formState.businessPrice} onChange={(val) => editForm.update({ businessPrice: val })} variant="compact" className="w-full" />
                  ) : (
                    <p className="flex h-10 items-center">
                      {type === 'dropoff' ? product.dropoffBusinessPrice : product.pickupBusinessPrice}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex w-56 justify-end gap-2">
                    {editingProductId === product.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEditedProduct(product.id)}
                          className="min-w-24 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="min-w-24 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditProduct(product.id)}
                          className="min-w-24 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="min-w-24 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Loeschen
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-5xl text-slate-900">Produkte</h2>
      <p className="mt-2 text-sm text-slate-600">
        Produkte koennen hier angelegt, bearbeitet und bei fehlender Historie geloescht werden.
      </p>

      <form onSubmit={submitProduct} className="mt-4 grid gap-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <ProductNameInput
            label="Material"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. Betonrecycling 0/45"
          />
        </div>

        <div>
          <ProductUnitInput
            label="Einheit"
            value={createForm.formState.unit}
            onChange={(val) => createForm.update({ unit: val })}
            placeholder="t"
          />
        </div>

        <div>
          <ProductFlowSelect
            label="Typ"
            value={createForm.formState.flow}
            onChange={(val) => createForm.update({ flow: val })}
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Preis Privat (€)</label>
          <PriceField value={createForm.formState.privatePrice} onChange={(val) => createForm.update({ privatePrice: val })} placeholder="0" className="mt-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Preis Unternehmen (€)</label>
          <PriceField value={createForm.formState.businessPrice} onChange={(val) => createForm.update({ businessPrice: val })} placeholder="0" className="mt-2" />
        </div>

        <div className="md:col-span-6">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Produkt anlegen
          </button>
        </div>
      </form>

      {createForm.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>}
      {createForm.success && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>}

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="font-title text-3xl text-slate-900">Annahme</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Kundenanlieferungen.</p>

          <ProductCards type="dropoff" />
          <ProductTable type="dropoff" />
        </div>

        <div>
          <h3 className="font-title text-3xl text-slate-900">Verkauf</h3>
          <p className="mt-1 text-sm text-slate-600">Produkte fuer Materialabholung durch den Kunden.</p>

          <ProductCards type="pickup" />
          <ProductTable type="pickup" />
        </div>
      </div>
    </section>
  )
}
