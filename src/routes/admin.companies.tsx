import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppState } from '../state/app-state'
import { useCompanyForm } from '../hooks/use-company-form'
import { CompanyInput, PinInput, PriceCategorySelect } from '../components/company-form-inputs'

export const Route = createFileRoute('/admin/companies')({ component: AdminCompaniesPage })

function AdminCompaniesPage() {
  const { companies, createCompany, updateCompany, deleteCompany } = useAppState()
  const createForm = useCompanyForm()
  const editForm = useCompanyForm()
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)

  function submitCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = createCompany({
      shortCode: createForm.formState.shortCode,
      name: createForm.formState.name,
      pin: createForm.formState.pin,
      priceCategory: createForm.formState.priceCategory,
    })

    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    createForm.setMessage(`Firma ${createForm.formState.shortCode.trim().toUpperCase()} wurde angelegt.`, 'success')
    createForm.reset()
  }

  function cancelEdit() {
    setEditingCompanyId(null)
    editForm.reset()
  }

  function startEditCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId)
    if (!company) return

    setEditingCompanyId(company.id)
    editForm.update({
      shortCode: company.shortCode,
      name: company.name,
      pin: company.pin,
      priceCategory: company.priceCategory,
    })
  }

  function saveEditedCompany(companyId: string) {
    const result = updateCompany({
      id: companyId,
      shortCode: editForm.formState.shortCode,
      name: editForm.formState.name,
      pin: editForm.formState.pin,
      priceCategory: editForm.formState.priceCategory,
    })

    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    editForm.setMessage(`Firma ${editForm.formState.shortCode.trim().toUpperCase()} wurde aktualisiert.`, 'success')
    cancelEdit()
  }

  function removeCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId)
    if (!company) return

    if (!window.confirm(`Firma ${company.shortCode} wirklich loeschen?`)) {
      return
    }

    const result = deleteCompany({ id: companyId })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    if (editingCompanyId === companyId) cancelEdit()

    editForm.setMessage(`Firma ${company.shortCode} wurde geloescht.`, 'success')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Firmen</h2>
      <p className="mt-2 text-sm text-slate-600">
        Firmen koennen hier angelegt, bearbeitet und bei fehlender Historie geloescht werden.
      </p>

      <form onSubmit={submitCompany} className="mt-4 grid gap-4 md:grid-cols-5">
        <div>
          <CompanyInput
            label="Kuerzel"
            value={createForm.formState.shortCode}
            onChange={(val) => createForm.update({ shortCode: val.toUpperCase().slice(0, 6) })}
            placeholder="z.B. KR"
          />
        </div>

        <div className="md:col-span-2">
          <CompanyInput
            label="Firmenname"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. Krampfert Wohnbau GmbH"
          />
        </div>

        <div>
          <PinInput
            label="PIN (4-stellig)"
            value={createForm.formState.pin}
            onChange={(val) => createForm.update({ pin: val })}
          />
        </div>

        <div>
          <PriceCategorySelect
            label="Tarifgruppe"
            value={createForm.formState.priceCategory}
            onChange={(val) => createForm.update({ priceCategory: val })}
          />
        </div>

        <div className="md:col-span-5">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Firma anlegen
          </button>
        </div>
      </form>

      {createForm.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>}
      {createForm.success && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>
      )}

      <div className="mt-5 space-y-3 md:hidden">
        {companies.map((company) => (
          <article key={company.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Kuerzel</p>
            {editingCompanyId === company.id ? (
              <input
                value={editForm.formState.shortCode}
                onChange={(event) =>
                  editForm.update({ shortCode: event.target.value.toUpperCase().slice(0, 6) })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900">{company.shortCode}</p>
            )}

            <p className="mt-3 text-xs text-slate-500">Firma</p>
            {editingCompanyId === company.id ? (
              <input
                value={editForm.formState.name}
                onChange={(event) => editForm.update({ name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <p className="text-sm text-slate-800">{company.name}</p>
            )}

            <p className="mt-3 text-xs text-slate-500">PIN</p>
            {editingCompanyId === company.id ? (
              <input
                value={editForm.formState.pin}
                onChange={(event) =>
                  editForm.update({ pin: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-800">{company.pin}</p>
            )}

            <p className="mt-3 text-xs text-slate-500">Tarifgruppe</p>
            {editingCompanyId === company.id ? (
              <select
                value={editForm.formState.priceCategory}
                onChange={(event) => editForm.update({ priceCategory: event.target.value as any })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="business">Unternehmen</option>
                <option value="private">Privat</option>
              </select>
            ) : (
              <p className="text-sm font-semibold text-slate-800">
                {company.priceCategory === 'private' ? 'Privat' : 'Unternehmen'}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {editingCompanyId === company.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveEditedCompany(company.id)}
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
                    onClick={() => startEditCompany(company.id)}
                    className="min-w-24 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCompany(company.id)}
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

      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-2xl table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-24 px-3 py-2">Kuerzel</th>
              <th className="w-[38%] px-3 py-2">Firma</th>
              <th className="w-24 px-3 py-2">PIN</th>
              <th className="w-44 px-3 py-2">Tarifgruppe</th>
              <th className="w-56 px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2">
                  {editingCompanyId === company.id ? (
                    <input
                      value={editForm.formState.shortCode}
                      onChange={(event) =>
                        editForm.update({ shortCode: event.target.value.toUpperCase().slice(0, 6) })
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="flex h-10 items-center font-semibold text-slate-800">{company.shortCode}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingCompanyId === company.id ? (
                    <input
                      value={editForm.formState.name}
                      onChange={(event) => editForm.update({ name: event.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="flex h-10 items-center truncate">{company.name}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingCompanyId === company.id ? (
                    <input
                      value={editForm.formState.pin}
                      onChange={(event) =>
                        editForm.update({ pin: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                      }
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <p className="flex h-10 items-center">{company.pin}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingCompanyId === company.id ? (
                    <select
                      value={editForm.formState.priceCategory}
                      onChange={(event) => editForm.update({ priceCategory: event.target.value as any })}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="business">Unternehmen</option>
                      <option value="private">Privat</option>
                    </select>
                  ) : (
                    <p className="flex h-10 items-center">{company.priceCategory === 'private' ? 'Privat' : 'Unternehmen'}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex w-56 justify-end gap-2">
                    {editingCompanyId === company.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEditedCompany(company.id)}
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
                          onClick={() => startEditCompany(company.id)}
                          className="min-w-24 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCompany(company.id)}
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
