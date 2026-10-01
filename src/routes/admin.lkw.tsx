import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAppState } from '../state/app-state'
import { useTruckForm } from '../hooks/use-truck-form'
import { ProductNameInput, PriceField } from '../components/product-form-inputs'
import { Spinner } from '../components/spinner'
import type { Truck } from '../state/app-state'

export const Route = createFileRoute('/admin/lkw')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminTrucksPage,
})

type EditFormState = {
  name: string
  privatePrice: string
  businessPrice: string
}

type TruckListProps = {
  items: Truck[]
  editingTruckId: number | null
  editFormState: EditFormState
  onEditFormUpdate: (update: Partial<EditFormState>) => void
  onSave: (truckId: number) => void
  onCancel: () => void
  onStartEdit: (truckId: number) => void
  onRemove: (truckId: number) => void
  isSaving: boolean
  isRemoving: boolean
}

function TruckCards({ items, editingTruckId, editFormState, onEditFormUpdate, onSave, onCancel, onStartEdit, onRemove, isSaving, isRemoving }: TruckListProps) {
  return (
    <div className="mt-3 space-y-3 md:hidden">
      {items.map((truck) => (
        <article key={truck.id} className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">LKW</p>
          {editingTruckId === truck.id ? (
            <input
              value={editFormState.name}
              onChange={(event) => onEditFormUpdate({ name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-900">{truck.name}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Privat (€/Std.)</p>
              {editingTruckId === truck.id ? (
                <PriceField value={editFormState.privatePrice} onChange={(val) => onEditFormUpdate({ privatePrice: val })} variant="compact" className="mt-1" />
              ) : (
                <p className="font-semibold text-slate-800">{truck.privatePrice} €</p>
              )}
            </div>
            <div>
              <p className="text-slate-500">Unternehmen (€/Std.)</p>
              {editingTruckId === truck.id ? (
                <PriceField value={editFormState.businessPrice} onChange={(val) => onEditFormUpdate({ businessPrice: val })} variant="compact" className="mt-1" />
              ) : (
                <p className="font-semibold text-slate-800">{truck.businessPrice} €</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {editingTruckId === truck.id ? (
              <>
                <button
                  type="button"
                  onClick={() => onSave(truck.id)}
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
                  onClick={() => onStartEdit(truck.id)}
                  className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(truck.id)}
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

function TruckTable({ items, editingTruckId, editFormState, onEditFormUpdate, onSave, onCancel, onStartEdit, onRemove, isSaving, isRemoving }: TruckListProps) {
  return (
    <div className="mt-3 hidden overflow-x-auto md:block">
      <table className="w-full min-w-3xl table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-[38%] px-3 py-2">LKW</th>
            <th className="w-40 px-3 py-2">Privat (€/Std.)</th>
            <th className="w-44 px-3 py-2">Unternehmen (€/Std.)</th>
            <th className="w-56 px-3 py-2 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {items.map((truck) => (
            <tr key={truck.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
              <td className="px-3 py-2">
                {editingTruckId === truck.id ? (
                  <input
                    value={editFormState.name}
                    onChange={(event) => onEditFormUpdate({ name: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                ) : (
                  <p className="flex h-10 items-center truncate">{truck.name}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {editingTruckId === truck.id ? (
                  <PriceField value={editFormState.privatePrice} onChange={(val) => onEditFormUpdate({ privatePrice: val })} variant="compact" className="w-full" />
                ) : (
                  <p className="flex h-10 items-center">{truck.privatePrice}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {editingTruckId === truck.id ? (
                  <PriceField value={editFormState.businessPrice} onChange={(val) => onEditFormUpdate({ businessPrice: val })} variant="compact" className="w-full" />
                ) : (
                  <p className="flex h-10 items-center">{truck.businessPrice}</p>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  {editingTruckId === truck.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onSave(truck.id)}
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
                        onClick={() => onStartEdit(truck.id)}
                        aria-label="Bearbeiten"
                        title="Bearbeiten"
                        className="rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(truck.id)}
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

function AdminTrucksPage() {
  const { trucks, createTruck, isCreatingTruck, updateTruck, isUpdatingTruck, deleteTruck, isDeletingTruck } = useAppState()
  const createForm = useTruckForm()
  const editForm = useTruckForm()
  const [editingTruckId, setEditingTruckId] = useState<number | null>(null)

  async function submitTruck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await createTruck({
      name: createForm.formState.name,
      privatePrice: createForm.formState.privatePrice,
      businessPrice: createForm.formState.businessPrice,
    })

    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    createForm.setMessage(`LKW ${createForm.formState.name.trim()} wurde angelegt.`, 'success')
    createForm.reset()
  }

  function cancelEdit() {
    setEditingTruckId(null)
    editForm.reset()
  }

  function startEditTruck(truckId: number) {
    const truck = trucks.find((item) => item.id === truckId)
    if (!truck) return

    setEditingTruckId(truck.id)
    editForm.update({
      name: truck.name,
      privatePrice: String(truck.privatePrice),
      businessPrice: String(truck.businessPrice),
    })
  }

  async function saveEditedTruck(truckId: number) {
    const truck = trucks.find((item) => item.id === truckId)
    if (!truck) return

    const result = await updateTruck({
      id: truck.id,
      name: editForm.formState.name,
      privatePrice: editForm.formState.privatePrice,
      businessPrice: editForm.formState.businessPrice,
    })

    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    editForm.setMessage(`LKW ${editForm.formState.name.trim()} wurde aktualisiert.`, 'success')
    cancelEdit()
  }

  async function removeTruck(truckId: number) {
    const truck = trucks.find((item) => item.id === truckId)
    if (!truck) return

    if (!window.confirm(`LKW ${truck.name} wirklich löschen?`)) {
      return
    }

    const result = await deleteTruck({ id: truckId })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    if (editingTruckId === truckId) cancelEdit()

    editForm.setMessage(`LKW ${truck.name} wurde gelöscht.`, 'success')
  }

  const listProps = {
    editingTruckId,
    editFormState: {
      name: editForm.formState.name,
      privatePrice: editForm.formState.privatePrice,
      businessPrice: editForm.formState.businessPrice,
    },
    onEditFormUpdate: editForm.update,
    onSave: saveEditedTruck,
    onCancel: cancelEdit,
    onStartEdit: startEditTruck,
    onRemove: removeTruck,
    isSaving: isUpdatingTruck,
    isRemoving: isDeletingTruck,
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">LKW</h2>
      <p className="mt-2 text-sm text-slate-600">
        LKW-Stundenpreise können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden.
      </p>

      <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-700">Neuen LKW anlegen</h3>

        <form onSubmit={submitTruck} className="mt-4 space-y-4">
          <ProductNameInput
            label="LKW"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. LKW 3-Achser inkl. Maut"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Privat (€/Std.)</label>
              <PriceField value={createForm.formState.privatePrice} onChange={(val) => createForm.update({ privatePrice: val })} placeholder="0" className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Unternehmen (€/Std.)</label>
              <PriceField value={createForm.formState.businessPrice} onChange={(val) => createForm.update({ businessPrice: val })} placeholder="0" className="mt-2" />
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

        {createForm.error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>
        )}
        {createForm.success && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>
        )}
      </div>

      <div className="mt-6">
        <TruckCards items={trucks} {...listProps} />
        <TruckTable items={trucks} {...listProps} />
      </div>
    </section>
  )
}
