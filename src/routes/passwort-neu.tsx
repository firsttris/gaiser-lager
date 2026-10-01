import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { PageShell } from '../components/page-shell'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { ADMIN_PASSWORD_MIN_LENGTH } from '../server/admin-auth'
import { adminCompletePasswordReset } from '../server/admin-password-reset'

export const Route = createFileRoute('/passwort-neu')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: NewPasswordPage,
})

// Target of the link in the "Passwort vergessen" mail.
function NewPasswordPage() {
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const complete = useMutation({ mutationFn: adminCompletePasswordReset })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
      setError(`Das Passwort muss mindestens ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen haben.`)
      return
    }
    if (password !== repeat) {
      setError('Die beiden Passwörter stimmen nicht überein.')
      return
    }
    try {
      const result = await complete.mutateAsync({ data: { token: token ?? '', password } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setDone(true)
    } catch {
      setError('Der Link ist ungültig oder abgelaufen. Bitte neu anfordern.')
    }
  }

  return (
    <PageShell>
      <section className="mx-auto mt-4 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-10">
        <Logo className="h-14" />
        <h1 className="mt-6 font-title text-4xl leading-none text-slate-900">Neues Admin-Passwort</h1>
        {done ? (
          <>
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-700">
              Das Passwort wurde geändert. Alle bisherigen Anmeldungen wurden beendet.
            </p>
            <Link
              to="/admin"
              className="mt-6 flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-black"
            >
              Zur Admin-Anmeldung
            </Link>
          </>
        ) : !token ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">
            Der Link ist unvollständig.{' '}
            <Link to="/passwort-vergessen" className="font-semibold underline">
              Neuen Link anfordern
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Neues Passwort
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`mind. ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen`}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-slate-800"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Neues Passwort wiederholen
              <input
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-slate-800"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}{' '}
                {error.includes('abgelaufen') && (
                  <Link to="/passwort-vergessen" className="font-semibold underline">
                    Neuen Link anfordern
                  </Link>
                )}
              </p>
            )}
            <button
              type="submit"
              disabled={complete.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {complete.isPending && <Spinner className="h-4 w-4" />}
              Passwort speichern
            </button>
          </form>
        )}
      </section>
    </PageShell>
  )
}
