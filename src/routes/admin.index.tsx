import { Navigate, createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (isAdminLoggedIn) throw redirect({ to: '/admin/vorgaenge' })
  },
  // Logging in on /admin doesn't re-run beforeLoad: without this the page
  // stayed empty after a successful login.
  component: () => <Navigate to="/admin/vorgaenge" replace />,
})
