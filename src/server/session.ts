import { getSession, updateSession, clearSession, type SessionConfig } from '@tanstack/react-start/server'

function requireSessionSecret() {
  const password = process.env.SESSION_SECRET
  if (!password) {
    throw new Error('SESSION_SECRET is not set')
  }
  return password
}

export type AdminSessionData = {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type CustomerSessionData = {
  companyId: string
  loggedInAt: number
}

function adminSessionConfig(): SessionConfig {
  return { name: 'gaiser_admin', password: requireSessionSecret(), maxAge: 60 * 60 * 12 }
}

function customerSessionConfig(): SessionConfig {
  return { name: 'gaiser_customer', password: requireSessionSecret(), maxAge: 60 * 60 * 24 * 7 }
}

export const getAdminSession = () => getSession<AdminSessionData>(adminSessionConfig())
export const setAdminSession = (data: AdminSessionData) => updateSession<AdminSessionData>(adminSessionConfig(), data)
export const clearAdminSession = () => clearSession(adminSessionConfig())

export const getCustomerSession = () => getSession<CustomerSessionData>(customerSessionConfig())
export const setCustomerSession = (data: CustomerSessionData) =>
  updateSession<CustomerSessionData>(customerSessionConfig(), data)
export const clearCustomerSession = () => clearSession(customerSessionConfig())

export type EmployeeSessionData = {
  employeeId: string
  loggedInAt: number
}

// Drivers share the kiosk tablet: a work day at most, plus the inactivity
// logout on the client.
function employeeSessionConfig(): SessionConfig {
  return { name: 'gaiser_employee', password: requireSessionSecret(), maxAge: 60 * 60 * 12 }
}

export const getEmployeeSession = () => getSession<EmployeeSessionData>(employeeSessionConfig())
export const setEmployeeSession = (data: EmployeeSessionData) =>
  updateSession<EmployeeSessionData>(employeeSessionConfig(), data)
export const clearEmployeeSession = () => clearSession(employeeSessionConfig())
