import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { PageShell } from '../components/page-shell'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { adminRequestPasswordReset } from '../server/admin-password-reset'
import { isValidEmail } from '../utils/email'

export const Route = createFileRoute('/passwort-vergessen')({ component: ForgotPasswordPage })

// Admins only (customers and drivers use PINs that the office resets).
function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const request = useMutation({ mutationFn: adminRequestPasswordReset })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (!isValidEmail(email)) {
      setMessage({ kind: 'error', text: 'Bitte eine gültige E-Mail-Adresse eingeben.' })
      return
    }
    try {
      const result = await request.mutateAsync({ data: { email: email.trim() } })
      setMessage({ kind: result.ok ? 'success' : 'error', text: result.message })
    } catch {
      setMessage({ kind: 'error', text: 'Anfrage fehlgeschlagen. Bitte erneut versuchen.' })
    }
  }

  return (
    <PageShell>
      <section className="mx-auto mt-4 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
        <Logo className="h-14" />
        <h1 className="mt-6 font-title text-4xl leading-none text-slate-900">Admin-Passwort vergessen</h1>
        <p className="mt-3 text-slate-700">
          Wir schicken einen Link an die E-Mail-Adresse des Admin-Kontos. Darüber legen Sie ein neues Passwort fest.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            E-Mail
            <input
              type="email"
              value={email}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <button
            type="submit"
            disabled={request.isPending || message?.kind === 'success'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {request.isPending && <Spinner className="h-4 w-4" />}
            Link anfordern
          </button>
        </form>
        {message && (
          <p className={`mt-4 rounded-xl p-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {message.text}
          </p>
        )}
        <p className="mt-6 text-sm text-slate-700">
          Kommt keine E-Mail an (z.B. weil der E-Mail-Versand noch nicht eingerichtet ist), kann das Passwort im
          Supabase-Dashboard zurückgesetzt werden.
        </p>
        <Link to="/admin" className="mt-4 flex min-h-12 items-center justify-center font-semibold text-slate-700 no-underline hover:text-slate-900">
          Zurück zur Admin-Anmeldung
        </Link>
      </section>
    </PageShell>
  )
}
