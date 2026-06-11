import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/sites')({ component: AdminSitesPage })

function AdminSitesPage() {
  const { constructionSites, createConstructionSite, updateConstructionSite, deleteConstructionSite } = useAppState()
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  function submitConstructionSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = createConstructionSite({ name: createName })
    if (!result.ok) {
      setCreateError(result.message)
      setCreateSuccess('')
      return
    }

    setCreateError('')
    setCreateSuccess(`Baustelle ${createName.trim()} wurde angelegt.`)
    setCreateName('')
  }

  function startEdit(siteId: string) {
    const site = constructionSites.find((item) => item.id === siteId)
    if (!site) return

    setEditingSiteId(site.id)
    setEditName(site.name)
    setEditError('')
    setEditSuccess('')
  }

  function cancelEdit() {
    setEditingSiteId(null)
    setEditName('')
    setEditError('')
  }

  function saveEdit(siteId: string) {
    const result = updateConstructionSite({ id: siteId, name: editName })
    if (!result.ok) {
      setEditError(result.message)
      setEditSuccess('')
      return
    }

    setEditError('')
    setEditSuccess(`Baustelle ${editName.trim()} wurde aktualisiert.`)
    cancelEdit()
  }

  function removeConstructionSite(siteId: string) {
    const site = constructionSites.find((item) => item.id === siteId)
    if (!site) return

    if (!window.confirm(`Baustelle ${site.name} wirklich loeschen?`)) {
      return
    }

    const result = deleteConstructionSite({ id: site.id })
    if (!result.ok) {
      setEditError(result.message)
      setEditSuccess('')
      return
    }

    if (editingSiteId === site.id) {
      cancelEdit()
    }

    setEditError('')
    setEditSuccess(`Baustelle ${site.name} wurde geloescht.`)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Baustellen</h2>
      <p className="mt-2 text-sm text-slate-600">
        Baustellen koennen hier angelegt, bearbeitet und bei fehlender Historie geloescht werden.
      </p>

      <form onSubmit={submitConstructionSite} className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-4">
          <label className="text-sm font-semibold text-slate-700">Baustelle</label>
          <input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="z.B. Nordring 12, Berlin"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
          />
        </div>

        <div className="md:col-span-1 md:self-end">
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Baustelle anlegen
          </button>
        </div>
      </form>

      {createError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
      {createSuccess && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createSuccess}</p>}
      {editError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
      {editSuccess && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{editSuccess}</p>}

      <div className="mt-5 space-y-3 md:hidden">
        {constructionSites.map((site) => (
          <article key={site.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Baustelle</p>
            {editingSiteId === site.id ? (
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900">{site.name}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {editingSiteId === site.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveEdit(site.id)}
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
                    onClick={() => startEdit(site.id)}
                    className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConstructionSite(site.id)}
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

      <div className="mt-5 hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2">Baustelle</th>
              <th className="w-56 px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {constructionSites.map((site) => (
              <tr key={site.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2">
                  {editingSiteId === site.id ? (
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="line-clamp-2 text-slate-800">{site.name}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex w-56 justify-end gap-2">
                    {editingSiteId === site.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(site.id)}
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
                          onClick={() => startEdit(site.id)}
                          className="min-w-24 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => removeConstructionSite(site.id)}
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
    </section>
  )
}
