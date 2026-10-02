import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { type ConstructionSite, useAppState } from '../state/app-state'
import { Spinner } from '../components/spinner'
import { FormDialog } from '../components/form-dialog'
import { ConfirmDialog } from '../components/confirm-dialog'
import { SelectInput } from '../components/select-input'

export const Route = createFileRoute('/admin/baustellen')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminSitesPage,
})

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800'
const SELECT_CLASS = 'mt-2 w-full min-h-12 px-4 py-3 font-normal'

function AdminSitesPage() {
  const {
    companies,
    constructionSites,
    createConstructionSite,
    isCreatingConstructionSite,
    updateConstructionSite,
    isUpdatingConstructionSite,
    deleteConstructionSite,
  } = useAppState()
  const [createName, setCreateName] = useState('')
  const [createCompanyId, setCreateCompanyId] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [editCompanyId, setEditCompanyId] = useState('')
  const [createMessage, setCreateMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [deletingSite, setDeletingSite] = useState<ConstructionSite | null>(null)
  const [listMessage, setListMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'de')), [companies])
  const companyName = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies])
  const visibleSites = constructionSites
    .filter((site) => companyFilter === 'all' || site.companyId === companyFilter)
    .sort(
      (a, b) =>
        (companyName.get(a.companyId) ?? '').localeCompare(companyName.get(b.companyId) ?? '', 'de') ||
        a.name.localeCompare(b.name, 'de'),
    )

  const companyOptions = sortedCompanies.map((company) => ({ value: company.id, label: company.name }))

  async function submitConstructionSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!createCompanyId) {
      setCreateMessage({ kind: 'error', text: 'Bitte einen Kunden auswählen.' })
      return
    }
    const result = await createConstructionSite({ name: createName, companyId: createCompanyId })
    if (!result.ok) {
      setCreateMessage({ kind: 'error', text: result.message })
      return
    }

    setCreateMessage({ kind: 'success', text: `Baustelle ${createName.trim()} wurde angelegt.` })
    setCreateName('')
  }

  function startEdit(site: ConstructionSite) {
    setEditName(site.name)
    setEditCompanyId(site.companyId)
    setEditError('')
    setEditingSite(site)
  }

  async function saveEdit() {
    if (!editingSite) return

    if (!editCompanyId) {
      setEditError('Bitte einen Kunden auswählen.')
      return
    }
    const result = await updateConstructionSite({ id: editingSite.id, name: editName, companyId: editCompanyId })
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
        Jede Baustelle gehört zu genau einem Kunden und wird nur diesem vorgeschlagen. Baustellen können hier angelegt,
        bearbeitet und bei fehlender Historie gelöscht werden.
      </p>

      <form onSubmit={submitConstructionSite} className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-700">Kunde</label>
          <SelectInput
            value={createCompanyId}
            onChange={setCreateCompanyId}
            options={companyOptions}
            className={SELECT_CLASS}
            placeholder="Bitte Kunde auswählen"
            label="Kunde"
          />
        </div>
        <div className="md:col-span-2">
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

      <label className="mt-6 block max-w-sm text-sm font-semibold text-slate-700">
        Kunde
        <SelectInput
          value={companyFilter}
          onChange={setCompanyFilter}
          options={[{ value: 'all', label: 'Alle Kunden' }, ...companyOptions]}
          className={SELECT_CLASS}
          label="Kunde"
        />
      </label>

      <div className="mt-4 space-y-3">
        {visibleSites.map((site) => (
          <article
            key={site.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 odd:bg-white even:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="font-semibold wrap-break-word text-slate-900">{site.name}</p>
              <p className="text-sm text-slate-700">{companyName.get(site.companyId) ?? '—'}</p>
            </div>
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
        <div>
          <label className="text-sm font-semibold text-slate-700">Kunde</label>
          <SelectInput
            value={editCompanyId}
            onChange={setEditCompanyId}
            options={companyOptions}
            className={SELECT_CLASS}
            placeholder="Bitte Kunde auswählen"
            label="Kunde"
          />
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
