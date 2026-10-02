import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { adminCreateEmployee, adminDeleteEmployee, adminEmployeesQueryOptions, adminUpdateEmployee } from '../server/employees'
import { ConfirmDialog } from '../components/confirm-dialog'
import { CompanyInput, PinInput } from '../components/company-form-inputs'
import { FormDialog } from '../components/form-dialog'
import { Spinner } from '../components/spinner'

export const Route = createFileRoute('/admin/mitarbeiter')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminEmployeesPage,
})

type Employee = { id: string; name: string; active: boolean }

// Driver logins (name + 4-digit PIN). Deactivate for a break, delete when
// someone leaves; old Vorgänge keep "Gebucht von" either way.
function AdminEmployeesPage() {
  const queryClient = useQueryClient()
  const { data: employees = [] } = useQuery(adminEmployeesQueryOptions())
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] })
    void queryClient.invalidateQueries({ queryKey: ['employee-names'] })
  }
  const createMutation = useMutation({ mutationFn: adminCreateEmployee, onSuccess: refresh })
  const updateMutation = useMutation({ mutationFn: adminUpdateEmployee, onSuccess: refresh })
  const deleteMutation = useMutation({ mutationFn: adminDeleteEmployee, onSuccess: refresh })
  const [deleting, setDeleting] = useState<Employee | null>(null)

  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [createMessage, setCreateMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [listMessage, setListMessage] = useState('')

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !/^\d{4}$/.test(pin)) {
      setCreateMessage({ kind: 'error', text: 'Bitte Namen und eine 4-stellige PIN eingeben.' })
      return
    }
    const result = await createMutation.mutateAsync({ data: { name, pin } })
    if (!result.ok) {
      setCreateMessage({ kind: 'error', text: result.message })
      return
    }
    setCreateMessage({ kind: 'success', text: `${name.trim()} wurde angelegt.` })
    setName('')
    setPin('')
  }

  function startEdit(employee: Employee) {
    setEditing(employee)
    setEditName(employee.name)
    setEditPin('')
    setEditActive(employee.active)
    setEditError('')
  }

  async function save() {
    if (!editing) return
    if (editPin && !/^\d{4}$/.test(editPin)) {
      setEditError('Die neue PIN muss 4-stellig sein.')
      return
    }
    const result = await updateMutation.mutateAsync({ data: { id: editing.id, name: editName, active: editActive, pin: editPin } })
    if (!result.ok) {
      setEditError(result.message)
      return
    }
    setListMessage(`${editName.trim()} wurde gespeichert${editPin ? ', PIN wurde geändert' : ''}.`)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    const employee = deleting
    setDeleting(null)
    const result = await deleteMutation.mutateAsync({ data: { id: employee.id } })
    setListMessage(result.ok ? `${employee.name} wurde gelöscht.` : result.message)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Mitarbeiter</h2>
      <p className="mt-2 text-sm text-slate-700">
        Logins für die LKW-Fahrer (Name + 4-stellige PIN). Anmeldung über „Mitarbeiter-Anmeldung“ auf der Startseite.
        Deaktivieren sperrt die Anmeldung vorübergehend; Löschen entfernt den Login ganz. Bei alten Vorgängen bleibt
        „Gebucht von“ in beiden Fällen erhalten.
      </p>

      <form onSubmit={create} className="mt-4 grid max-w-2xl gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <CompanyInput label="Name" value={name} onChange={setName} placeholder="z.B. Max M." />
        </div>
        <PinInput label="PIN (4-stellig)" value={pin} onChange={setPin} />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 sm:col-span-3 sm:justify-self-start"
        >
          {createMutation.isPending && <Spinner className="h-4 w-4" />}
          Mitarbeiter anlegen
        </button>
        {createMessage && (
          <p
            className={`rounded-xl p-3 text-sm sm:col-span-3 ${createMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {createMessage.text}
          </p>
        )}
      </form>

      {listMessage && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{listMessage}</p>}

      <div className="mt-6 space-y-3">
        {employees.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-slate-700">Noch keine Mitarbeiter angelegt.</p>}
        {employees.map((employee) => (
          <article
            key={employee.id}
            className={`flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 ${employee.active ? 'bg-white' : 'bg-slate-100'}`}
          >
            <div>
              <p className="font-semibold text-slate-900">{employee.name}</p>
              {!employee.active && <p className="text-sm text-slate-700">deaktiviert</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(employee)}
                aria-label={`${employee.name} bearbeiten`}
                title="Bearbeiten"
                className="rounded-xl bg-slate-100 p-3 text-slate-800 hover:bg-slate-200"
              >
                <Pencil className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(employee)}
                disabled={deleteMutation.isPending}
                aria-label={`${employee.name} löschen`}
                title="Löschen"
                className="rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Mitarbeiter löschen"
        message={`${deleting?.name ?? ''} wirklich löschen? Die Anmeldung ist danach nicht mehr möglich. Bei alten Vorgängen bleibt „Gebucht von“ erhalten.`}
        confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />

      <FormDialog
        open={editing !== null}
        title="Mitarbeiter bearbeiten"
        onClose={() => setEditing(null)}
        onSubmit={() => void save()}
        isSaving={updateMutation.isPending}
        error={editError}
      >
        <CompanyInput label="Name" value={editName} onChange={setEditName} placeholder="z.B. Max M." />
        <PinInput label="Neue PIN (leer = unverändert)" value={editPin} onChange={setEditPin} />
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={editActive}
            onChange={(event) => setEditActive(event.target.checked)}
            className="h-6 w-6 rounded border-slate-300"
          />
          <span className="font-semibold text-slate-800">Aktiv (kann sich anmelden)</span>
        </label>
      </FormDialog>
    </section>
  )
}
