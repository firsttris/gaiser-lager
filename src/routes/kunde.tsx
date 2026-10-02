import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()

  // Session ended while on a customer page (expired, PIN changed, logged out
  // elsewhere): straight back to the login page, never a "please log in" page.
  // Reads the query cache directly: right after login the cache is already up
  // to date while the context may not have re-rendered yet.
  useEffect(() => {
    const session = queryClient.getQueryData(customerSessionStatusQueryOptions().queryKey)
    if (!session?.isLoggedIn && !isLoggingOut) window.location.assign('/')
  }, [isLoggedIn, isLoggingOut, queryClient])

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
