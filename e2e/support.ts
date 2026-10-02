/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { expect, test as base, type Page } from '@playwright/test'

export const FIXTURES_FILE = path.resolve('e2e/.data/fixtures.json')

export type E2eFixtures = {
  runId: string
  company: { name: string; pin: string }
  driver: { name: string; pin: string }
  admin: { email: string; password: string }
  masterPin: string
}

// Test data created by global-setup.ts for this run.
export const test = base.extend<{ data: E2eFixtures }>({
  // eslint-disable-next-line no-empty-pattern
  data: async ({}, use) => {
    await use(JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8')) as E2eFixtures)
  },
})
export { expect }

// Unique per test, so bookings of parallel tests never mix.
export function uniqueSite(label: string) {
  return `${label} ${Math.random().toString(36).slice(2, 7)}`
}

export async function tapPin(page: Page, pin: string) {
  const pad = page.getByRole('group', { name: /PIN/ })
  for (const digit of pin) await pad.getByRole('button', { name: digit, exact: true }).tap()
}

// Same way a customer logs in at the kiosk: search the company, type the PIN on
// the pad; the fourth digit submits.
export async function loginAsCustomer(page: Page, company: { name: string; pin: string }) {
  await page.goto('/')
  await page.getByRole('combobox').fill(company.name)
  await page.getByRole('option', { name: company.name }).tap()
  await tapPin(page, company.pin)
  await expect(page).toHaveURL(/\/kunde\/neuer-vorgang/)
}

export async function loginAsDriver(page: Page, driver: { name: string; pin: string }) {
  await page.goto('/mitarbeiter')
  await page.getByRole('button', { name: driver.name }).tap()
  await tapPin(page, driver.pin)
  await expect(page).toHaveURL(/\/mitarbeiter\/neuer-vorgang/)
}

export async function loginAsAdmin(page: Page, admin: { email: string; password: string }) {
  await page.goto('/admin')
  await page.getByPlaceholder('E-Mail eingeben').fill(admin.email)
  await page.getByPlaceholder('Passwort eingeben').fill(admin.password)
  await page.getByRole('button', { name: 'Als Admin anmelden' }).tap()
  await expect(page.getByRole('button', { name: 'Als Admin anmelden' })).toBeHidden()
}

// "Andere Baustelle …" / "Baustelle wählen …" → type a new address → create it.
export async function chooseNewSite(page: Page, siteName: string) {
  await page.getByRole('group', { name: 'Baustelle' }).getByRole('button', { name: /Baustelle …|Baustelle wählen …/ }).tap()
  await page.getByLabel('Baustelle suchen oder neu eingeben').fill(siteName)
  await page.getByRole('button', { name: `„${siteName}“ als neue Baustelle anlegen` }).tap()
}
