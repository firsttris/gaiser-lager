import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallAppButtonProps = {
  className?: string
  compact?: boolean
}

export function InstallAppButton({ className = '', compact = false }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const updateStandaloneState = () => {
      setIsStandalone(mediaQuery.matches || window.navigator.standalone === true)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsStandalone(true)
      setDeferredPrompt(null)
    }

    updateStandaloneState()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    mediaQuery.addEventListener('change', updateStandaloneState)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery.removeEventListener('change', updateStandaloneState)
    }
  }, [])

  if (isStandalone || !deferredPrompt) return null

  const baseClasses = compact
    ? 'inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900 transition hover:bg-amber-100'
    : 'inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100'

  return (
    <button
      type="button"
      onClick={async () => {
        if (!deferredPrompt) return

        const promptEvent = deferredPrompt
        setDeferredPrompt(null)
        await promptEvent.prompt()
        await promptEvent.userChoice
      }}
      className={`${baseClasses} ${className}`.trim()}
    >
      <Download className="mr-2 h-4 w-4" strokeWidth={2.2} />
      Installieren
    </button>
  )
}