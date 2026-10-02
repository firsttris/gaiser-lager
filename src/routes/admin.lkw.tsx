import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAppState } from '../state/app-state'
import { useTruckForm } from '../hooks/use-truck-form'
import { ProductNameInput, PriceField } from '../components/product-form-inputs'
import { Spinner } from '../components/spinner'
import { FormDialog } from '../components/form-dialog'
import { ConfirmDialog } from '../components/confirm-dialog'
import { money } from '../utils/history-utils'
import type { Truck } from '../state/app-state'

export const Route = createFileRoute('/admin/lkw')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminTrucksPage,
})

function TruckActions({
  truck,
  onEdit,
  onDelete,
}: {
  truck: Truck
  onEdit: (truck: Truck) => void
  onDelete: (truck: Truck) => void
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => onEdit(truck)}
        aria-label={`${truck.name} bearbeiten`}
        title="Bearbeiten"
        className="rounded-xl bg-slate-100 p-3 text-slate-800 hover:bg-slate-200"
      >
        <Pencil className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(truck)}
        aria-label={`${truck.name} löschen`}
        title="Löschen"
        className="rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </div>
  )
}

function AdminTrucksPage() {
  const { trucks, createTruck, isCreatingTruck, updateTruck, isUpdatingTruck, deleteTruck } = useAppState()
  const createForm = useTruckForm()
  const editForm = useTruckForm()
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null)
  const [deletingTruck, setDeletingTruck] = useState<Truck | null>(null)
  const [listMessage, setListMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function submitTruck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await createTruck({ name: createForm.formState.name, price: createForm.formState.price })
    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    const name = createForm.formState.name.trim()
    createForm.reset()
    createForm.setMessage(`LKW ${name} wurde angelegt.`, 'success')
  }

  function startEdit(truck: Truck) {
    editForm.reset()
    editForm.update({ name: truck.name, price: String(truck.price).replace('.', ',') })
    setEditingTruck(truck)
  }

  async function saveEdit() {
    if (!editingTruck) return

    const result = await updateTruck({ id: editingTruck.id, name: editForm.formState.name, price: editForm.formState.price })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    setListMessage({ kind: 'success', text: `LKW ${editForm.formState.name.trim()} wurde aktualisiert.` })
    setEditingTruck(null)
  }

  async function confirmDelete() {
    const truck = deletingTruck
    setDeletingTruck(null)
    if (!truck) return

    const result = await deleteTruck({ id: truck.id })
    setListMessage(
      result.ok ? { kind: 'success', text: `LKW ${truck.name} wurde gelöscht.` } : { kind: 'error', text: result.message },
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">LKW</h2>
      <p className="mt-2 text-sm text-slate-700">
        LKW-Stundenpreise (netto) können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden.
      </p>

      <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Neuen LKW anlegen</h3>

        <form onSubmit={submitTruck} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <ProductNameInput
                label="LKW"
                value={createForm.formState.name}
                onChange={(val) => createForm.update({ name: val })}
                placeholder="z.B. LKW 3-Achser inkl. Maut"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Preis netto (€/Std.)</label>
              <PriceField
                value={createForm.formState.price}
                onChange={(val) => createForm.update({ price: val })}
                placeholder="z.B. 90"
                className="mt-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreatingTruck}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingTruck && <Spinner className="h-4 w-4" />}
            LKW anlegen
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

      <div className="mt-6 space-y-3">
        {trucks.map((truck) => (
          <article
            key={truck.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 odd:bg-white even:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="font-semibold wrap-break-word text-slate-900">{truck.name}</p>
              <p className="mt-1 text-sm text-slate-800">{money(truck.price)} / Std.</p>
            </div>
            <TruckActions truck={truck} onEdit={startEdit} onDelete={setDeletingTruck} />
          </article>
        ))}
      </div>

      <FormDialog
        open={editingTruck !== null}
        title="LKW bearbeiten"
        onClose={() => setEditingTruck(null)}
        onSubmit={() => void saveEdit()}
        isSaving={isUpdatingTruck}
        error={editForm.error}
      >
        <ProductNameInput
          label="LKW"
          value={editForm.formState.name}
          onChange={(val) => editForm.update({ name: val })}
          placeholder="z.B. LKW 3-Achser inkl. Maut"
        />
        <div>
          <label className="text-sm font-semibold text-slate-700">Preis netto (€/Std.)</label>
          <PriceField value={editForm.formState.price} onChange={(val) => editForm.update({ price: val })} className="mt-2" />
        </div>
        <p className="text-sm text-slate-700">
          Neuer Name/Preis gilt für neue Vorgänge. Bereits abgerechnete Vorgänge und Rechnungen bleiben unverändert.
        </p>
      </FormDialog>

      <ConfirmDialog
        open={deletingTruck !== null}
        title="LKW löschen"
        message={`LKW ${deletingTruck?.name ?? ''} wirklich löschen?`}
        confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingTruck(null)}
      />
    </section>
  )
}
