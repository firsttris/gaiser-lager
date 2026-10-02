import { useEffect } from 'react'

const CHECK_INTERVAL_MS = 5 * 60_000
const IDLE_BEFORE_RELOAD_MS = 30_000
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll']

// A kiosk page stays open for days, so after a deploy it would keep running
// the old version. This checks /version.json regularly and, once a newer
// build is live, reloads — but only on the customer login page and only when
// nobody has touched the screen for a while, so no half-filled form is lost.
// (Logging out also does a full reload, which picks up the new version too.)
export function useReloadOnNewVersion() {
  useEffect(() => {
    if (import.meta.env.DEV) return

    let newVersionAvailable = false
    let lastActivity = Date.now()
    const markActivity = () => {
      lastActivity = Date.now()
    }

    async function check() {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        if (!response.ok) return
        const { buildId } = (await response.json()) as { buildId?: string }
        if (buildId && buildId !== __APP_BUILD_ID__) newVersionAvailable = true
      } catch {
        // Offline or deploying — try again next round.
      }
    }

    function reloadIfIdle() {
      const onLoginPage = window.location.pathname === '/'
      if (newVersionAvailable && onLoginPage && Date.now() - lastActivity > IDLE_BEFORE_RELOAD_MS) {
        window.location.reload()
      }
    }

    for (const eventName of ACTIVITY_EVENTS) window.addEventListener(eventName, markActivity, { passive: true })
    const checkTimer = setInterval(() => void check(), CHECK_INTERVAL_MS)
    const idleTimer = setInterval(reloadIfIdle, 10_000)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) window.removeEventListener(eventName, markActivity)
      clearInterval(checkTimer)
      clearInterval(idleTimer)
    }
  }, [])
}
