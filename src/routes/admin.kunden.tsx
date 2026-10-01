import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useState } from 'react'
import { Mail, Pencil, Trash2 } from 'lucide-react'
import { type Company, useAppState } from '../state/app-state'
import { useCompanyForm } from '../hooks/use-company-form'
import { CompanyInput, PinInput } from '../components/company-form-inputs'
import { PostalCodeCityFields } from '../components/postal-code-city-fields'
import { FormDialog } from '../components/form-dialog'
import { ConfirmDialog } from '../components/confirm-dialog'
import { Spinner } from '../components/spinner'
import { isValidEmail } from '../utils/email'

export const Route = createFileRoute('/admin/kunden')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/' })
  },
  component: AdminKundenPage,
})

const INPUT_CLASS = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800'

function CompanyAddressFields({
  form,
}: {
  form: ReturnType<typeof useCompanyForm>
}) {
  return (
    <>
      <CompanyInput
        label="Straße"
        value={form.formState.street}
        onChange={(val) => form.update({ street: val })}
        placeholder="z.B. Bastian-Gugel-Straße 11"
        autoComplete="street-address"
      />
      <PostalCodeCityFields
        postalCode={form.formState.postalCode}
        city={form.formState.city}
        onChange={(update) => form.update(update)}
        inputClassName={INPUT_CLASS}
      />
    </>
  )
}

function AdminKundenPage() {
  const {
    companies,
    createCompany,
    isCreatingCompany,
    updateCompany,
    isUpdatingCompany,
    deleteCompany,
    setCompanyPin,
    isSettingCompanyPin,
  } = useAppState()
  const createForm = useCompanyForm()
  const editForm = useCompanyForm()
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null)
  const [listMessage, setListMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const companiesWithoutEmail = companies.filter((company) => !company.email).length

  async function submitCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = createForm.formState

    if (!isValidEmail(form.email)) {
      createForm.setMessage('Bitte eine gültige E-Mail-Adresse für Rechnungen eingeben.', 'error')
      return
    }

    const result = await createCompany({
      name: form.name,
      customerNumber: form.customerNumber,
      street: form.street,
      postalCode: form.postalCode,
      city: form.city,
      email: form.email,
      pin: form.pin,
    })

    if (!result.ok) {
      createForm.setMessage(result.message, 'error')
      return
    }

    const name = form.name.trim()
    createForm.reset()
    createForm.setMessage(`Kunde ${name} wurde angelegt.`, 'success')
  }

  function startEdit(company: Company) {
    editForm.reset()
    editForm.update({
      name: company.name,
      customerNumber: company.customerNumber,
      street: company.street,
      postalCode: company.postalCode,
      city: company.city,
      email: company.email,
      pin: '',
    })
    setEditingCompany(company)
  }

  async function saveEdit() {
    if (!editingCompany) return
    const form = editForm.formState

    if (form.email.trim() && !isValidEmail(form.email)) {
      editForm.setMessage('Bitte eine gültige E-Mail-Adresse eingeben (oder das Feld leer lassen).', 'error')
      return
    }
    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      editForm.setMessage('Die neue PIN muss 4-stellig sein.', 'error')
      return
    }

    const result = await updateCompany({
      id: editingCompany.id,
      name: form.name,
      customerNumber: form.customerNumber,
      street: form.street,
      postalCode: form.postalCode,
      city: form.city,
      email: form.email,
    })
    if (!result.ok) {
      editForm.setMessage(result.message, 'error')
      return
    }

    if (form.pin) {
      const pinResult = await setCompanyPin({ companyId: editingCompany.id, pin: form.pin })
      if (!pinResult.ok) {
        editForm.setMessage(pinResult.message, 'error')
        return
      }
    }

    setListMessage({
      kind: 'success',
      text: `Kunde ${form.name.trim()} wurde aktualisiert${form.pin ? ', PIN wurde geändert' : ''}.`,
    })
    setEditingCompany(null)
  }

  async function confirmDelete() {
    const company = deletingCompany
    setDeletingCompany(null)
    if (!company) return

    const result = await deleteCompany({ id: company.id })
    setListMessage(
      result.ok ? { kind: 'success', text: `Kunde ${company.name} wurde gelöscht.` } : { kind: 'error', text: result.message },
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Kunden</h2>
      <p className="mt-2 text-sm text-slate-700">
        Kunden können hier angelegt, bearbeitet und bei fehlender Historie gelöscht werden.
      </p>

      <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Neuen Kunden anlegen</h3>

        <form onSubmit={submitCompany} className="mt-4 space-y-4">
          <CompanyInput
            label="Kundenname"
            value={createForm.formState.name}
            onChange={(val) => createForm.update({ name: val })}
            placeholder="z.B. Krampfert Wohnbau GmbH"
          />

          <div className="grid grid-cols-2 gap-4">
            <CompanyInput
              label="Kundennummer"
              value={createForm.formState.customerNumber}
              onChange={(val) => createForm.update({ customerNumber: val })}
              placeholder="leer = automatisch"
              inputMode="numeric"
            />
            <PinInput
              label="PIN (4-stellig)"
              value={createForm.formState.pin}
              onChange={(val) => createForm.update({ pin: val })}
            />
          </div>

          <CompanyInput
            label="E-Mail für Rechnungen"
            value={createForm.formState.email}
            onChange={(val) => createForm.update({ email: val })}
            placeholder="z.B. buchhaltung@firma.de"
            type="email"
            inputMode="email"
          />

          <CompanyAddressFields form={createForm} />

          <button
            type="submit"
            disabled={isCreatingCompany}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingCompany && <Spinner className="h-4 w-4" />}
            Kunde anlegen
          </button>
        </form>

        {createForm.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{createForm.error}</p>}
        {createForm.success && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{createForm.success}</p>
        )}
      </div>

      {companiesWithoutEmail > 0 && (
        <p className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
          <Mail className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Bei {companiesWithoutEmail} {companiesWithoutEmail === 1 ? 'Kunde fehlt' : 'Kunden fehlt'} noch die E-Mail-Adresse
          für Rechnungen.
        </p>
      )}

      {listMessage && (
        <p
          className={`mt-5 rounded-xl p-3 text-sm ${listMessage.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {listMessage.text}
        </p>
      )}

      {/* Cards below the table breakpoint, so nothing gets squeezed. */}
      <div className="mt-5 space-y-3 lg:hidden">
        {companies.map((company) => (
          <article key={company.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold wrap-break-word text-slate-900">{company.name}</p>
                <p className="text-sm text-slate-700">Kd.-Nr. {company.customerNumber || '—'}</p>
              </div>
              <CompanyActions company={company} onEdit={startEdit} onDelete={setDeletingCompany} />
            </div>
            <p className="mt-2 text-sm text-slate-800">
              {company.street || '—'}
              <br />
              {[company.postalCode, company.city].filter(Boolean).join(' ') || '—'}
            </p>
            <CompanyEmail email={company.email} />
          </article>
        ))}
      </div>

      <div className="mt-5 hidden lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-700">
              <th className="px-3 py-2">Kundenname</th>
              <th className="w-28 px-3 py-2">Kd.-Nr.</th>
              <th className="px-3 py-2">Adresse</th>
              <th className="px-3 py-2">E-Mail</th>
              <th className="w-32 px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-slate-100 align-top odd:bg-white even:bg-slate-50">
                <td className="min-w-48 px-3 py-3 font-semibold wrap-break-word text-slate-900">{company.name}</td>
                <td className="px-3 py-3 text-slate-800">{company.customerNumber || '—'}</td>
                <td className="px-3 py-3 text-slate-800">
                  {company.street || '—'}
                  <br />
                  {[company.postalCode, company.city].filter(Boolean).join(' ')}
                </td>
                <td className="px-3 py-3 break-all">
                  <CompanyEmail email={company.email} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end">
                    <CompanyActions company={company} onEdit={startEdit} onDelete={setDeletingCompany} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormDialog
        open={editingCompany !== null}
        title="Kunde bearbeiten"
        onClose={() => setEditingCompany(null)}
        onSubmit={() => void saveEdit()}
        isSaving={isUpdatingCompany || isSettingCompanyPin}
        error={editForm.error}
      >
        <CompanyInput
          label="Kundenname"
          value={editForm.formState.name}
          onChange={(val) => editForm.update({ name: val })}
          placeholder="z.B. Krampfert Wohnbau GmbH"
        />
        <div className="grid grid-cols-2 gap-4">
          <CompanyInput
            label="Kundennummer"
            value={editForm.formState.customerNumber}
            onChange={(val) => editForm.update({ customerNumber: val })}
            placeholder="z.B. 10600"
            inputMode="numeric"
          />
          <PinInput
            label="Neue PIN (leer = unverändert)"
            value={editForm.formState.pin}
            onChange={(val) => editForm.update({ pin: val })}
          />
        </div>
        <CompanyInput
          label="E-Mail für Rechnungen"
          value={editForm.formState.email}
          onChange={(val) => editForm.update({ email: val })}
          placeholder="z.B. buchhaltung@firma.de"
          type="email"
          inputMode="email"
        />
        <CompanyAddressFields form={editForm} />
      </FormDialog>

      <ConfirmDialog
        open={deletingCompany !== null}
        title="Kunde löschen"
        message={`Kunde ${deletingCompany?.name ?? ''} wirklich löschen? Kunden mit Vorgängen können nicht gelöscht werden.`}
        confirmLabel="Löschen"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingCompany(null)}
      />
    </section>
  )
}

function CompanyEmail({ email }: { email: string }) {
  if (email) return <p className="mt-1 text-sm text-slate-800">{email}</p>
  return <p className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">E-Mail fehlt</p>
}

function CompanyActions({
  company,
  onEdit,
  onDelete,
}: {
  company: Company
  onEdit: (company: Company) => void
  onDelete: (company: Company) => void
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => onEdit(company)}
        aria-label={`${company.name} bearbeiten`}
        title="Bearbeiten"
        className="rounded-xl bg-slate-100 p-3 text-slate-800 hover:bg-slate-200"
      >
        <Pencil className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(company)}
        aria-label={`${company.name} löschen`}
        title="Löschen"
        className="rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </div>
  )
}
