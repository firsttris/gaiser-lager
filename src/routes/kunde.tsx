import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { customerSessionStatusQueryOptions } from '../server/customer-auth'
import { customerSignOut } from '../server/customer-auth'
import { signupSettingsQueryOptions } from '../server/signup-settings'
import { InactivityLogoutDialog } from '../components/inactivity-logout-dialog'

const WARNING_SECONDS = 30
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

export const Route = createFileRoute('/kunde')({
  beforeLoad: async ({ context }) => {
    const { isLoggedIn } = await context.queryClient.ensureQueryData(customerSessionStatusQueryOptions())
    if (!isLoggedIn) throw redirect({ to: '/' })
  },
  component: CustomerLayout,
})

function CustomerLayout() {
  const queryClient = useQueryClient()
  const { data: signupSettings } = useQuery(signupSettingsQueryOptions())

  const inactivityMinutes = signupSettings?.inactivityTimeoutMinutes ?? 5
  const inactivityMs = inactivityMinutes * 60_000

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningDeadlineRef = useRef<number | null>(null)
  const inactivityMsRef = useRef<number>(inactivityMs)

  const [warningDeadline, setWarningDeadline] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  const logoutMutation = useMutation({
    mutationFn: customerSignOut,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'customer'] })
      window.location.assign('/')
    },
  })

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
    if (logoutMutation.isPending) return

    clearTimers()
    clearWarning()
    void logoutMutation.mutateAsync({})
  }, [clearTimers, clearWarning, logoutMutation])

  const scheduleTimers = useCallback(() => {
    const timeoutMs = inactivityMsRef.current
    if (timeoutMs <= 0 || logoutMutation.isPending) return

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
  }, [clearTimers, clearWarning, logoutMutation.isPending, triggerLogout])

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
    <>
      <Outlet />
      <InactivityLogoutDialog
        open={warningDeadline !== null}
        secondsRemaining={secondsRemaining}
        totalSeconds={Math.min(WARNING_SECONDS, Math.floor(inactivityMs / 1000))}
        isLoggingOut={logoutMutation.isPending}
        onContinueSession={scheduleTimers}
        onLogoutNow={triggerLogout}
      />
    </>
  )
}
