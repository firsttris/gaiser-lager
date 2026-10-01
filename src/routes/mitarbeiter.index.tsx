import { createFileRoute, redirect } from '@tanstack/react-router'
import { employeeSessionStatusQueryOptions } from '../server/employee-auth'

// /mitarbeiter shows the driver login (rendered by the layout); once logged
// in it goes straight to "Neuer Vorgang".
export const Route = createFileRoute('/mitarbeiter/')({
  beforeLoad: async ({ context }) => {
    const { isLoggedIn } = await context.queryClient.ensureQueryData(employeeSessionStatusQueryOptions())
    if (isLoggedIn) throw redirect({ to: '/mitarbeiter/neuer-vorgang' })
  },
  component: () => null,
})
