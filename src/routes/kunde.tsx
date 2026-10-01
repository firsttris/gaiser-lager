import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { customerSessionStatusQueryOptions } from '../server/customer-auth'
import { InactivityGuard } from '../components/inactivity-guard'
import { useAppState } from '../state/app-state'

export const Route = createFileRoute('/kunde')({
  beforeLoad: async ({ context }) => {
    const { isLoggedIn } = await context.queryClient.ensureQueryData(customerSessionStatusQueryOptions())
    if (!isLoggedIn) throw redirect({ to: '/' })
  },
  component: CustomerLayout,
})

function CustomerLayout() {
  const { isLoggedIn, logout, isLoggingOut, signupSettings } = useAppState()

  // Session ended while on a customer page (expired, PIN changed, logged out
  // elsewhere): straight back to the login page, never a "please log in" page.
  useEffect(() => {
    if (!isLoggedIn && !isLoggingOut) window.location.assign('/')
  }, [isLoggedIn, isLoggingOut])

  if (!isLoggedIn) return null

  return (
    <>
      <Outlet />
      <InactivityGuard
        timeoutMinutes={signupSettings.inactivityTimeoutMinutes}
        onLogout={logout}
        isLoggingOut={isLoggingOut}
      />
    </>
  )
}
