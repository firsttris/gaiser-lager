import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Pencil, Trash2, Camera, Image as ImageIcon, X } from 'lucide-react'
import { useAppState } from '../state/app-state'
import { useProductForm } from '../hooks/use-product-form'
import { ProductNameInput, ProductUnitInput, ProductFlowSelect, PriceField } from '../components/product-form-inputs'
import { Spinner } from '../components/spinner'
import { fileToBase64 } from '../utils/file-to-base64'
import type { Product } from '../state/app-state'

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function ProductImageCell({
  product,
  isBusy,
  onUpload,
  onRemove,
}: {
  product: Product
  isBusy: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const inputId = `product-image-${product.id}`

  return (
    <div className="relative h-14 w-14 shrink-0">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}

      {isBusy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
          <Spinner className="h-4 w-4" />
        </div>
      )}

      <label
        htmlFor={inputId}
        title="Bild ändern"
        className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white hover:bg-black"
      >
        <Camera className="h-3 w-3" strokeWidth={2.5} />
      </label>
      <input
        id={inputId}
        type="file"
        accept={ALLOWED_PRODUCT_IMAGE_TYPES.join(',')}
        className="hidden"
        disabled={isBusy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onUpload(file)
        }}
      />

      {product.imageUrl && (
        <button
          type="button"
          onClick={onRemove}
          disabled={isBusy}
          title="Bild entfernen"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

export const Route = createFileRoute('/admin/material')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminProductsPage,
})

type EditFormState = {
  name: string
  unit: string
  privatePrice: string
  businessPrice: string
}

type ProductListProps = {
  type: 'dropoff' | 'pickup'
  items: Product[]
  editingProductId: number | null
  editFormState: EditFormState
  onEditFormUpdate: (update: Partial<EditFormState>) => void
  onSave: (productId: number) => void
  onCancel: () => void
  onStartEdit: (productId: number) => void
  onRemove: (productId: number) => void
  isSaving: boolean
  isRemoving: boolean
  imageActionProductId: number | null
  onImageUpload: (productId: number, file: File) => void
  onImageRemove: (productId: number) => void
}

function ProductCards({
  type,
  items,
  editingProductId,
  editFormState,
  onEditFormUpdate,
  onSave,
  onCancel,
  onStartEdit,
  onRemove,
  isSaving,
  isRemoving,
  imageActionProductId,
  onImageUpload,
  onImageRemove,
}: ProductListProps) {
  return (
    <div className="mt-3 space-y-3 md:hidden">
      {items.map((product) => (
        <article key={product.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <ProductImageCell
              product={product}
              isBusy={imageActionProductId === product.id}
              onUpload={(file) => onImageUpload(product.id, file)}
              onRemove={() => onImageRemove(product.id)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Material</p>
              {editingProductId === product.id ? (
                <input
                  value={editFormState.name}
                  onChange={(event) => onEditFormUpdate({ name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Einheit</p>
              {editingProductId === product.id ? (
                <input
                  value={editFormState.unit}
                  onChange={(event) => onEditFormUpdate({ unit: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="font-semibold text-slate-800">{product.unit}</p>
              )}
            </div>
            <div>
              <p className="text-slate-500">Privat</p>
              {editingProductId === product.id ? (
                <PriceField value={editFormState.privatePrice} onChange={(val) => onEditFormUpdate({ privatePrice: val })} variant="compact" className="mt-1" />
              ) : (
                <p className="font-semibold text-slate-800">
                  {type === 'dropoff' ? product.dropoffPrivatePrice : product.pickupPrivatePrice} €
                </p>
              )}
            </div>
            <div>
              <p className="text-slate-500">Unternehmen</p>
              {editingProductId === product.id ? (
                <PriceField value={editFormState.businessPrice} onChange={(val) => onEditFormUpdate({ businessPrice: val })} variant="compact" className="mt-1" />
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
                  onClick={() => onSave(product.id)}
                  disabled={isSaving}
                  className="flex min-w-24 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving && <Spinner className="h-3.5 w-3.5" />}
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onStartEdit(product.id)}
                  className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(product.id)}
                  disabled={isRemoving}
                  className="flex min-w-24 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRemoving && <Spinner className="h-3.5 w-3.5" />}
                  Löschen
                </button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function ProductTable({
  type,
  items,
  editingProductId,
  editFormState,
  onEditFormUpdate,
  onSave,
  onCancel,
  onStartEdit,
  onRemove,
  isSaving,
  isRemoving,
  imageActionProductId,
  onImageUpload,
  onImageRemove,
}: ProductListProps) {
  return (
    <div className="mt-3 hidden overflow-x-auto md:block">
      <table className="w-full min-w-3xl table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-20 px-3 py-2">Bild</th>
            <th className="w-[34%] px-3 py-2">Material</th>
            <th className="w-24 px-3 py-2">Einheit</th>
            <th className="w-40 px-3 py-2">Privat (€)</th>
            <th className="w-44 px-3 py-2">Unternehmen (€)</th>
            <th className="w-56 px-3 py-2 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => (
            <tr key={product.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
              <td className="px-3 py-2">
                <ProductImageCell
                  product={product}
                  isBusy={imageActionProductId === product.id}
                  onUpload={(file) => onImageUpload(product.id, file)}
                  onRemove={() => onImageRemove(product.id)}
                />
              </td>
              <td className="px-3 py-2">
                {editingProductId === product.id ? (
                  <input
                    value={editFormState.name}
                    onChange={(event) => onEditFormUpdate({ name: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                ) : (
                  <p className="flex h-10 items-center truncate">{product.name}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {editingProductId === product.id ? (
                  <input
                    value={editFormState.unit}
                    onChange={(event) => onEditFormUpdate({ unit: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                ) : (
                  <p className="flex h-10 items-center">{product.unit}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {editingProductId === product.id ? (
                  <PriceField value={editFormState.privatePrice} onChange={(val) => onEditFormUpdate({ privatePrice: val })} variant="compact" className="w-full" />
                ) : (
                  <p className="flex h-10 items-center">
                    {type === 'dropoff' ? product.dropoffPrivatePrice : product.pickupPrivatePrice}
                  </p>
                )}
              </td>
              <td className="px-3 py-2">
                {editingProductId === product.id ? (
                  <PriceField value={editFormState.businessPrice} onChange={(val) => onEditFormUpdate({ businessPrice: val })} variant="compact" className="w-full" />
                ) : (
                  <p className="flex h-10 items-center">
                    {type === 'dropoff' ? product.dropoffBusinessPrice : product.pickupBusinessPrice}
                  </p>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  {editingProductId === product.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onSave(product.id)}
                        disabled={isSaving}
                        className="flex min-w-24 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving && <Spinner className="h-3.5 w-3.5" />}
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="min-w-24 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartEdit(product.id)}
                        aria-label="Bearbeiten"
                        title="Bearbeiten"
                        className="rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(product.id)}
                        disabled={isRemoving}
                        aria-label="Löschen"
                        title="Löschen"
                        className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRemoving ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" strokeWidth={2.25} />}
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

function AdminProductsPage() {
  const {
    products,
    createProduct,
    isCreatingProduct,
    updateProduct,
    isUpdatingProduct,
    deleteProduct,
    isDeletingProduct,
    uploadProductImage,
    removeProductImage,
  } = useAppState()
  const createForm = useProductForm()
  const editForm = useProductForm()
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [imageActionProductId, setImageActionProductId] = useState<number | null>(null)
  const [imageError, setImageError] = useState('')

  const dropoffProducts = products.filter((product) => product.flow === 'dropoff')
  const pickupProducts = products.filter((product) => product.flow === 'pickup')

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await createProduct({
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

  async function saveEditedProduct(productId: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    const result = await updateProduct({
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

  async function removeProduct(productId: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    if (!window.confirm(`Produkt ${product.name} wirklich löschen?`)) {
      return
    }

    const result = await deleteProduct({ id: productId })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    if (editingProductId === productId) cancelEdit()

    editForm.setMessage(`Produkt ${product.name} wurde gelöscht.`, 'success')
  }

  async function handleImageUpload(productId: number, file: File) {
    setImageError('')

    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      setImageError('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.')
      return
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setImageError('Das Bild darf maximal 5 MB groß sein.')
      return
    }

    setImageActionProductId(productId)
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await uploadProductImage({ id: productId, fileBase64, contentType: file.type })
      if (!result.ok) setImageError(result.message)
    } finally {
      setImageActionProductId(null)
    }
  }

  async function handleImageRemove(productId: number) {
    setImageError('')
    setImageActionProductId(productId)
    try {
      const result = await removeProductImage({ id: productId })
      if (!result.ok) setImageError(result.message)
    } finally {
      setImageActionProductId(null)
    }
  }

  const listProps = {
    editingProductId,
    editFormState: {
      name: editForm.formState.name,
      unit: editForm.formState.unit,
      privatePrice: editForm.formState.privatePrice,
      businessPrice: editForm.formState.businessPrice,
    },
    onEditFormUpdate: editForm.update,
    onSave: saveEditedProduct,
    onCancel: cancelEdit,
    onStartEdit: startEditProduct,
    onRemove: removeProduct,
    isSaving: isUpdatingProduct,
    isRemoving: isDeletingProduct,
    imageActionProductId,
    onImageUpload: handleImageUpload,
    onImageRemove: handleImageRemove,
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Material</h2>
      <p className="mt-2 text-sm text-slate-600">
        Materialien können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden. Über das Kamera-Symbol
        am Bild kann pro Material ein Foto hinterlegt werden.
      </p>

      {imageError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{imageError}</p>}

      <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-700">Neues Material anlegen</h3>

        <form onSubmit={submitProduct} className="mt-4 space-y-4">
          <ProductNameInput
            label="Material"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. Betonrecycling 0/45"
          />

          <div className="grid grid-cols-2 gap-4">
            <ProductUnitInput
              label="Einheit"
              value={createForm.formState.unit}
              onChange={(val) => createForm.update({ unit: val })}
              placeholder="t"
            />
            <ProductFlowSelect
              label="Typ"
              value={createForm.formState.flow}
              onChange={(val) => createForm.update({ flow: val })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Privat (€)</label>
              <PriceField value={createForm.formState.privatePrice} onChange={(val) => createForm.update({ privatePrice: val })} placeholder="0" className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Unternehmen (€)</label>
              <PriceField value={createForm.formState.businessPrice} onChange={(val) => createForm.update({ businessPrice: val })} placeholder="0" className="mt-2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreatingProduct}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProduct && <Spinner className="h-4 w-4" />}
            Produkt anlegen
          </button>
        </form>

        {createForm.error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>
        )}
        {createForm.success && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>
        )}
      </div>

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="font-title text-3xl text-slate-900">Annahme</h3>
          <p className="mt-1 text-sm text-slate-600">Material für Kundenanlieferungen.</p>

          <ProductCards type="dropoff" items={dropoffProducts} {...listProps} />
          <ProductTable type="dropoff" items={dropoffProducts} {...listProps} />
        </div>

        <div>
          <h3 className="font-title text-3xl text-slate-900">Verkauf</h3>
          <p className="mt-1 text-sm text-slate-600">Material für Abholung durch den Kunden.</p>

          <ProductCards type="pickup" items={pickupProducts} {...listProps} />
          <ProductTable type="pickup" items={pickupProducts} {...listProps} />
        </div>
      </div>
    </section>
  )
}
