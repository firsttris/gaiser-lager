import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { type ConstructionSite, useAppState } from '../state/app-state'
import { Spinner } from '../components/spinner'
import { FormDialog } from '../components/form-dialog'
import { ConfirmDialog } from '../components/confirm-dialog'

export const Route = createFileRoute('/admin/baustellen')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminSitesPage,
})

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800'

function AdminSitesPage() {
  const {
    constructionSites,
    createConstructionSite,
    isCreatingConstructionSite,
    updateConstructionSite,
    isUpdatingConstructionSite,
    deleteConstructionSite,
  } = useAppState()
  const [createName, setCreateName] = useState('')
  const [createMessage, setCreateMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [deletingSite, setDeletingSite] = useState<ConstructionSite | null>(null)
  const [listMessage, setListMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function submitConstructionSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await createConstructionSite({ name: createName })
    if (!result.ok) {
      setCreateMessage({ kind: 'error', text: result.message })
      return
    }

    setCreateMessage({ kind: 'success', text: `Baustelle ${createName.trim()} wurde angelegt.` })
    setCreateName('')
  }

  function startEdit(site: ConstructionSite) {
    setEditName(site.name)
    setEditError('')
    setEditingSite(site)
  }

  async function saveEdit() {
    if (!editingSite) return

    const result = await updateConstructionSite({ id: editingSite.id, name: editName })
    if (!result.ok) {
      setEditError(result.message)
      return
    }

    setListMessage({ kind: 'success', text: `Baustelle ${editName.trim()} wurde aktualisiert.` })
    setEditingSite(null)
  }

  async function confirmDelete() {
    const site = deletingSite
    setDeletingSite(null)
    if (!site) return

    const result = await deleteConstructionSite({ id: site.id })
    setListMessage(
      result.ok ? { kind: 'success', text: `Baustelle ${site.name} wurde gelöscht.` } : { kind: 'error', text: result.message },
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Baustellen</h2>
      <p className="mt-2 text-sm text-slate-700">
        Baustellen können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden.
      </p>

      <form onSubmit={submitConstructionSite} className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-4">
          <label className="text-sm font-semibold text-slate-700">Baustelle</label>
          <input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="z.B. Nordring 12, Berlin"
            className={INPUT_CLASS}
          />
        </div>

        <div className="md:col-span-1 md:self-end">
          <button
            type="submit"
            disabled={isCreatingConstructionSite}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingConstructionSite && <Spinner className="h-4 w-4" />}
            Baustelle anlegen
          </button>
        </div>
      </form>

      {createMessage && (
        <p
          className={`mt-4 rounded-xl p-3 text-sm ${createMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {createMessage.text}
        </p>
      )}
      {listMessage && (
        <p
          className={`mt-4 rounded-xl p-3 text-sm ${listMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {listMessage.text}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {constructionSites.map((site) => (
          <article
            key={site.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 odd:bg-white even:bg-slate-50"
          >
            <p className="min-w-0 font-semibold wrap-break-word text-slate-900">{site.name}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => startEdit(site)}
                aria-label={`${site.name} bearbeiten`}
                title="Bearbeiten"
                className="rounded-xl bg-slate-100 p-3 text-slate-800 hover:bg-slate-200"
              >
                <Pencil className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingSite(site)}
                aria-label={`${site.name} löschen`}
                title="Löschen"
                className="rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <FormDialog
        open={editingSite !== null}
        title="Baustelle bearbeiten"
        onClose={() => setEditingSite(null)}
        onSubmit={() => void saveEdit()}
        isSaving={isUpdatingConstructionSite}
        error={editError}
      >
        <div>
          <label className="text-sm font-semibold text-slate-700">Baustelle</label>
          <input value={editName} onChange={(event) => setEditName(event.target.value)} className={INPUT_CLASS} />
        </div>
        <p className="text-sm text-slate-700">
          Der neue Name gilt für offene Vorgänge. Bereits abgerechnete Vorgänge und Rechnungen bleiben unverändert.
        </p>
      </FormDialog>

      <ConfirmDialog
        open={deletingSite !== null}
        title="Baustelle löschen"
        message={`Baustelle ${deletingSite?.name ?? ''} wirklich löschen? Baustellen mit Vorgängen können nicht gelöscht werden.`}
        confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingSite(null)}
      />
    </section>
  )
}
