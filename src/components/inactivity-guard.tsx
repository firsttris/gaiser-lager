import { useCallback, useEffect, useRef, useState } from 'react'
import { InactivityLogoutDialog } from './inactivity-logout-dialog'

const WARNING_SECONDS = 30
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

// Logs the current user out after `timeoutMinutes` without input, showing a
// countdown for the last 30 seconds. Shared by the customer and admin areas —
// the kiosk tablet is used by many people one after another.
export function InactivityGuard({
  timeoutMinutes,
  onLogout,
  isLoggingOut,
}: {
  /** 0 disables the automatic logout. */
  timeoutMinutes: number
  onLogout: () => void | Promise<void>
  isLoggingOut: boolean
}) {
  const inactivityMs = timeoutMinutes * 60_000

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningDeadlineRef = useRef<number | null>(null)
  const inactivityMsRef = useRef<number>(inactivityMs)

  const [warningDeadline, setWarningDeadline] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
  }, [])

  const clearWarning = useCallback(() => {
    warningDeadlineRef.current = null
    setWarningDeadline(null)
  }, [])

  const triggerLogout = useCallback(() => {
    if (isLoggingOut) return

    clearTimers()
    clearWarning()
    void onLogout()
  }, [clearTimers, clearWarning, isLoggingOut, onLogout])

  const scheduleTimers = useCallback(() => {
    const timeoutMs = inactivityMsRef.current
    if (timeoutMs <= 0 || isLoggingOut) return

    clearTimers()
    clearWarning()

    const warningMs = Math.min(WARNING_SECONDS * 1000, timeoutMs)
    const warningDelayMs = Math.max(timeoutMs - warningMs, 0)

    warningTimerRef.current = setTimeout(() => {
      const deadline = Date.now() + warningMs
      warningDeadlineRef.current = deadline
      setWarningDeadline(deadline)
    }, warningDelayMs)

    logoutTimerRef.current = setTimeout(() => {
      triggerLogout()
    }, timeoutMs)
  }, [clearTimers, clearWarning, isLoggingOut, triggerLogout])

  useEffect(() => {
    inactivityMsRef.current = inactivityMs
  }, [inactivityMs])

  useEffect(() => {
    if (inactivityMs <= 0) {
      clearTimers()
      clearWarning()
      return
    }

    scheduleTimers()

    const handleActivity = () => {
      if (warningDeadlineRef.current !== null) return
      scheduleTimers()
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity)
      }
      clearTimers()
    }
  }, [inactivityMs, clearTimers, clearWarning, scheduleTimers])

  useEffect(() => {
    if (warningDeadline === null) return

    const intervalId = setInterval(() => {
      setCurrentTime(Date.now())
    }, 250)

    return () => clearInterval(intervalId)
  }, [warningDeadline])

  const secondsRemaining = warningDeadline === null ? 0 : Math.max(0, Math.ceil((warningDeadline - currentTime) / 1000))

  return (
    <InactivityLogoutDialog
      open={warningDeadline !== null}
      secondsRemaining={secondsRemaining}
      totalSeconds={Math.min(WARNING_SECONDS, Math.floor(inactivityMs / 1000))}
      isLoggingOut={isLoggingOut}
      onContinueSession={scheduleTimers}
      onLogoutNow={triggerLogout}
    />
  )
}
