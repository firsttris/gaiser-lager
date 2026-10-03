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
  /** Fixed, presentable names for the screenshots that go to customers. */
  showcase: { company: { name: string; pin: string }; driver: { name: string; pin: string } }
}

export const FONT_SCALES = ['normal', 'large', 'xlarge'] as const
export type FontScale = (typeof FONT_SCALES)[number]

// The A / A+ / A++ switch stores its choice per device; set it before the
// page loads, as on a tablet where someone picked it once.
export async function useFontScale(page: Page, scale: FontScale) {
  await page.addInitScript((value) => localStorage.setItem('gaiser-font-scale', value), scale)
}

// Fails with a list of what is wrong when, on the current screen, the page
// scrolls sideways, two tap targets overlap, or a label spills out of its
// button. Intentionally cut-off text (ellipsis) is fine.
export async function expectCleanLayout(page: Page, screen: string, { soft = false }: { soft?: boolean } = {}) {
  await page.waitForLoadState('networkidle')
  const problems = await page.evaluate(() => {
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > window.innerWidth + 1) found.push(`Seite scrollt seitlich (${root.scrollWidth}px > ${window.innerWidth}px)`)

    const isShown = (el: Element) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && !el.closest('[aria-hidden="true"]')
    }
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()} „${(el.getAttribute('aria-label') || el.textContent || (el as HTMLInputElement).placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 40)}“`
    const targets = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea')].filter(isShown)

    for (let i = 0; i < targets.length; i++) {
      const a = targets[i].getBoundingClientRect()
      for (let j = i + 1; j < targets.length; j++) {
        if (targets[i].contains(targets[j]) || targets[j].contains(targets[i])) continue
        const b = targets[j].getBoundingClientRect()
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (overlapX > 2 && overlapY > 2) found.push(`${name(targets[i])} überlappt ${name(targets[j])}`)
      }
    }

    for (const el of targets) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') continue
      const style = getComputedStyle(el)
      if (style.overflowX !== 'visible' || style.textOverflow === 'ellipsis') continue
      if (el.scrollWidth > el.clientWidth + 2) found.push(`Text ragt aus ${name(el)} heraus`)
    }
    return found
  })
  ;(soft ? expect.soft : expect)(problems, `Layout-Probleme auf „${screen}“`).toEqual([])
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

// Picks the site if it is already a button or in the dialog, else creates it.
export async function chooseSite(page: Page, siteName: string) {
  const group = page.getByRole('group', { name: 'Baustelle' })
  const button = group.getByRole('button', { name: siteName, exact: true })
  if (await button.count()) return button.tap()
  await group.getByRole('button', { name: /Baustelle …|Baustelle wählen …/ }).tap()
  await page.getByLabel('Baustelle suchen oder neu eingeben').fill(siteName)
  const existing = page.getByRole('option', { name: siteName, exact: true })
  if (await existing.count()) return existing.tap()
  await page.getByRole('button', { name: `„${siteName}“ als neue Baustelle anlegen` }).tap()
}

// Material tile in "Material und Menge" by its name.
export async function chooseMaterial(page: Page, name: string) {
  await page.getByRole('button', { name }).first().tap()
}

// Quick amount, or the number pad for anything else ("12,5").
export async function chooseAmount(page: Page, group: 'Menge' | 'Stunden', amount: string) {
  const quick = page.getByRole('group', { name: group }).getByRole('button', { name: amount, exact: true })
  if (await quick.count()) return quick.tap()
  await page.getByRole('group', { name: group }).getByRole('button', { name: 'Andere …' }).tap()
  const dialog = page.getByRole('dialog')
  for (const key of amount) await dialog.getByRole('button', { name: key === ',' ? 'Komma' : key, exact: true }).tap()
  await dialog.getByRole('button', { name: 'Übernehmen' }).tap()
}
