import { chooseNewSite, expect, loginAsCustomer, tapPin, test, uniqueSite } from './support'

test('Kunde: falsche PIN wird abgelehnt', async ({ page, data }) => {
  await page.goto('/')
  await page.getByRole('combobox').fill(data.company.name)
  await page.getByRole('option', { name: data.company.name }).tap()
  await tapPin(page, '0000')
  await expect(page.locator('p.text-red-700')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('Kunde: Material holen, Lieferschein laden, dann "Wie zuletzt"', async ({ page, data }) => {
  const site = uniqueSite('Nordring')
  await loginAsCustomer(page, data.company)

  // First booking: quick amount, new site, book directly (no review step).
  await page.getByText('Material holen').first().tap()
  await expect(page.getByRole('heading', { name: 'Material und Menge' })).toBeVisible()
  const submit = page.getByRole('button', { name: 'Vorgang anlegen' })
  await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: '10', exact: true }).tap()
  await expect(page.getByText('Baustelle fehlt')).toBeVisible()
  await expect(submit).toBeDisabled()
  await chooseNewSite(page, site)
  await submit.tap()

  await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lieferschein herunterladen' }).tap()
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/)

  // Second booking: one tap on "Wie zuletzt" fills material, amount and site.
  await page.getByRole('link', { name: 'Neuen Vorgang anlegen' }).tap()
  await page.getByText('Material holen').first().tap()
  const last = page.getByRole('button', { name: /Wie zuletzt/ })
  await expect(last).toContainText(site)
  await last.tap()
  await expect(page.getByRole('group', { name: 'Baustelle' }).getByRole('button', { name: site })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: '10', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await submit.tap()
  await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()

  // Both show up in the customer's list.
  await page.getByRole('link', { name: 'Zu den Vorgängen' }).tap()
  await expect(page.getByRole('row').filter({ hasText: site })).toHaveCount(2)
})
