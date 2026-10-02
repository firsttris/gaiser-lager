import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { Logo } from '../components/logo'
import { Spinner } from '../components/spinner'
import { CompanyInput, PinInput } from '../components/company-form-inputs'
import { PostalCodeCityFields } from '../components/postal-code-city-fields'
import { isValidEmail } from '../utils/email'

export const Route = createFileRoute('/registrieren')({ component: RegistrierenPage })

function RegistrierenPage() {
  const { signUp, isSigningUp, verifyMasterPin, isVerifyingMasterPin, isLoggedIn } = useAppState()
  const navigate = Route.useNavigate()

  const [step, setStep] = useState<'masterpin' | 'konto'>('masterpin')
  const [masterPin, setMasterPin] = useState('')
  const [masterPinError, setMasterPinError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirmation, setPinConfirmation] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoggedIn) void navigate({ to: '/kunde/neuer-vorgang' })
  }, [isLoggedIn, navigate])

  async function submitMasterPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (masterPin.length !== 4) {
      setMasterPinError('Bitte eine 4-stellige PIN eingeben.')
      return
    }

    try {
      const result = await verifyMasterPin({ masterPin })
      if (!result.ok) {
        setMasterPinError(result.message)
        return
      }

      setMasterPinError('')
      setStep('konto')
    } catch {
      setMasterPinError('Master-PIN ist ungültig.')
    }
  }

  async function submitSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValidEmail(email)) {
      setError('Bitte eine gültige E-Mail-Adresse für Rechnungen eingeben.')
      return
    }

    if (pin.length !== 4) {
      setError('Bitte eine 4-stellige PIN eingeben.')
      return
    }

    if (pin !== pinConfirmation) {
      setError('Die PINs stimmen nicht überein.')
      return
    }

    try {
      const result = await signUp({
        masterPin,
        name,
        email,
        pin,
        pinConfirmation,
        street,
        postalCode,
        city,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setError('')
      void navigate({ to: '/kunde/neuer-vorgang' })
    } catch {
      setError('Registrierung fehlgeschlagen. Bitte Eingaben prüfen.')
    }
  }

  if (isLoggedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-slate-400" />
      </div>
    )
  }

  return (
    <PageShell>
      <TopNav />

      <section className="relative mx-auto mt-8 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-amber-100 blur-3xl"></div>
        <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sky-100 blur-3xl"></div>

        <div className="relative grid gap-8 p-6 sm:grid-cols-2 sm:p-10">
          <div className="space-y-4">
            <Logo className="mb-2 h-16" />
            <h1 className="font-title text-5xl leading-none text-slate-900 sm:text-6xl">
              Konto
              <br />
              erstellen.
            </h1>
            <p className="max-w-sm text-slate-600">
              {step === 'masterpin'
                ? 'Gib zunächst die Master-PIN ein, die du von uns erhalten hast.'
                : 'Firmendaten ausfüllen, eigene PIN vergeben. Fertig.'}
            </p>
          </div>

          {step === 'masterpin' ? (
            <form onSubmit={submitMasterPin} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <PinInput label="Master-PIN" value={masterPin} onChange={setMasterPin} />

              {masterPinError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{masterPinError}</p>}

              <button
                type="submit"
                disabled={isVerifyingMasterPin}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifyingMasterPin && <Spinner className="h-4 w-4" />}
                Weiter
              </button>

              <div className="border-t border-slate-200 pt-3 text-center">
                <Link to="/" className="inline-flex min-h-12 items-center text-sm font-semibold text-slate-600 no-underline hover:text-slate-900">
                  Zurück zur Anmeldung
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={submitSignUp} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <CompanyInput
                label="Kundenname"
                value={name}
                onChange={setName}
                placeholder="z.B. Krampfert Wohnbau GmbH"
              />

              <CompanyInput
                label="E-Mail für Rechnungen"
                value={email}
                onChange={setEmail}
                placeholder="z.B. buchhaltung@firma.de"
                type="email"
                inputMode="email"
                autoComplete="email"
              />

              <div className="grid gap-4 grid-cols-2">
                <PinInput label="Ihre PIN (4-stellig)" value={pin} onChange={setPin} />
                <PinInput label="PIN bestätigen" value={pinConfirmation} onChange={setPinConfirmation} />
              </div>

              <CompanyInput
                label="Straße"
                value={street}
                onChange={setStreet}
                placeholder="z.B. Bastian-Gugel-Straße 11"
              />

              <PostalCodeCityFields
                postalCode={postalCode}
                city={city}
                onChange={(update) => {
                  if (update.postalCode !== undefined) setPostalCode(update.postalCode)
                  if (update.city !== undefined) setCity(update.city)
                }}
                inputClassName="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-800"
              />

              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={isSigningUp}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningUp && <Spinner className="h-4 w-4" />}
                Konto erstellen
              </button>

              <div className="border-t border-slate-200 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setStep('masterpin')}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Zurück
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PageShell>
  )
}
