import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Pencil, Trash2, Camera, Image as ImageIcon, X } from 'lucide-react'
import { useAppState } from '../state/app-state'
import { useProductForm } from '../hooks/use-product-form'
import { ProductNameInput, ProductUnitInput, ProductFlowSelect, PriceField } from '../components/product-form-inputs'
import { Spinner } from '../components/spinner'
import { FormDialog } from '../components/form-dialog'
import { ConfirmDialog } from '../components/confirm-dialog'
import { money } from '../utils/history-utils'
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

type ProductListProps = {
  items: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  imageActionProductId: number | null
  onImageUpload: (productId: number, file: File) => void
  onImageRemove: (productId: number) => void
}

function ProductActions({ product, onEdit, onDelete }: { product: Product } & Pick<ProductListProps, 'onEdit' | 'onDelete'>) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => onEdit(product)}
        aria-label={`${product.name} bearbeiten`}
        title="Bearbeiten"
        className="rounded-xl bg-slate-100 p-3 text-slate-800 hover:bg-slate-200"
      >
        <Pencil className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(product)}
        aria-label={`${product.name} löschen`}
        title="Löschen"
        className="rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </div>
  )
}

function ProductList({ items, onEdit, onDelete, imageActionProductId, onImageUpload, onImageRemove }: ProductListProps) {
  const image = (product: Product) => (
    <ProductImageCell
      product={product}
      isBusy={imageActionProductId === product.id}
      onUpload={(file) => onImageUpload(product.id, file)}
      onRemove={() => onImageRemove(product.id)}
    />
  )

  return (
    <div className="@container">
      {/* Cards when the list has too little room for the table (container query). */}
      <div className="mt-3 space-y-3 @2xl:hidden">
        {items.map((product) => (
          <article key={product.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            {image(product)}
            <div className="min-w-0 flex-1">
              <p className="font-semibold wrap-break-word text-slate-900">{product.name}</p>
              <p className="mt-1 text-sm text-slate-800">
                {money(product.price)} / {product.unit}
              </p>
            </div>
            <ProductActions product={product} onEdit={onEdit} onDelete={onDelete} />
          </article>
        ))}
      </div>

      <div className="mt-3 hidden @2xl:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-700">
              <th className="w-20 px-3 py-2">Bild</th>
              <th className="px-3 py-2">Material</th>
              <th className="w-24 px-3 py-2">Einheit</th>
              <th className="w-32 px-3 py-2 text-right">Preis</th>
              <th className="w-32 px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-b border-slate-100 align-middle odd:bg-white even:bg-slate-50">
                <td className="px-3 py-3">{image(product)}</td>
                <td className="px-3 py-3 font-semibold wrap-break-word text-slate-900">{product.name}</td>
                <td className="px-3 py-3 text-slate-800">{product.unit}</td>
                <td className="px-3 py-3 text-right text-slate-900">{money(product.price)}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end">
                    <ProductActions product={product} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    uploadProductImage,
    removeProductImage,
  } = useAppState()
  const createForm = useProductForm()
  const editForm = useProductForm()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [listMessage, setListMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
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
      price: createForm.formState.price,
    })

    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    const name = createForm.formState.name.trim()
    createForm.reset()
    createForm.setMessage(`Material ${name} wurde angelegt.`, 'success')
  }

  function startEdit(product: Product) {
    editForm.reset()
    editForm.update({
      name: product.name,
      unit: product.unit,
      flow: product.flow,
      price: String(product.price).replace('.', ','),
    })
    setEditingProduct(product)
  }

  async function saveEdit() {
    if (!editingProduct) return

    const result = await updateProduct({
      id: editingProduct.id,
      name: editForm.formState.name,
      unit: editForm.formState.unit,
      flow: editingProduct.flow,
      price: editForm.formState.price,
    })

    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    setListMessage({ kind: 'success', text: `Material ${editForm.formState.name.trim()} wurde aktualisiert.` })
    setEditingProduct(null)
  }

  async function confirmDelete() {
    const product = deletingProduct
    setDeletingProduct(null)
    if (!product) return

    const result = await deleteProduct({ id: product.id })
    setListMessage(
      result.ok ? { kind: 'success', text: `Material ${product.name} wurde gelöscht.` } : { kind: 'error', text: result.message },
    )
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
    onEdit: startEdit,
    onDelete: setDeletingProduct,
    imageActionProductId,
    onImageUpload: handleImageUpload,
    onImageRemove: handleImageRemove,
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Material</h2>
      <p className="mt-2 text-sm text-slate-700">
        Materialien können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden. Über das Kamera-Symbol
        am Bild kann pro Material ein Foto hinterlegt werden. Alle Preise netto.
      </p>

      {imageError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{imageError}</p>}

      <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Neues Material anlegen</h3>

        <form onSubmit={submitProduct} className="mt-4 space-y-4">
          <ProductNameInput
            label="Material"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. Betonrecycling 0/45"
          />

          <div className="grid grid-cols-3 gap-4">
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
            <div>
              <label className="text-sm font-semibold text-slate-700">Preis netto (€)</label>
              <PriceField
                value={createForm.formState.price}
                onChange={(val) => createForm.update({ price: val })}
                placeholder="z.B. 12,50"
                className="mt-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreatingProduct}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingProduct && <Spinner className="h-4 w-4" />}
            Material anlegen
          </button>
        </form>

        {createForm.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>}
        {createForm.success && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>
        )}
      </div>

      {listMessage && (
        <p
          className={`mt-5 rounded-xl p-3 text-sm ${listMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {listMessage.text}
        </p>
      )}

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="font-title text-3xl text-slate-900">Annahme</h3>
          <p className="mt-1 text-sm text-slate-700">Material, das Kunden anliefern.</p>
          <ProductList items={dropoffProducts} {...listProps} />
        </div>

        <div>
          <h3 className="font-title text-3xl text-slate-900">Verkauf</h3>
          <p className="mt-1 text-sm text-slate-700">Material zur Abholung durch den Kunden.</p>
          <ProductList items={pickupProducts} {...listProps} />
        </div>
      </div>

      <FormDialog
        open={editingProduct !== null}
        title="Material bearbeiten"
        onClose={() => setEditingProduct(null)}
        onSubmit={() => void saveEdit()}
        isSaving={isUpdatingProduct}
        error={editForm.error}
      >
        <ProductNameInput
          label="Material"
          value={editForm.formState.name}
          onChange={(val) => editForm.update({ name: val })}
          placeholder="z.B. Betonrecycling 0/45"
        />
        <div className="grid grid-cols-2 gap-4">
          <ProductUnitInput
            label="Einheit"
            value={editForm.formState.unit}
            onChange={(val) => editForm.update({ unit: val })}
            placeholder="t"
          />
          <div>
            <label className="text-sm font-semibold text-slate-700">Preis netto (€)</label>
            <PriceField value={editForm.formState.price} onChange={(val) => editForm.update({ price: val })} className="mt-2" />
          </div>
        </div>
        <p className="text-sm text-slate-700">
          Neuer Name/Preis gilt für neue Vorgänge. Bereits abgerechnete Vorgänge und Rechnungen bleiben unverändert.
        </p>
      </FormDialog>

      <ConfirmDialog
        open={deletingProduct !== null}
        title="Material löschen"
        message={`Material ${deletingProduct?.name ?? ''} wirklich löschen?`}
        confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingProduct(null)}
      />
    </section>
  )
}
