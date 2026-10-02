import { expect, tapPin, test } from './support'

test('Neue Firma registriert sich mit Master-PIN und kann direkt buchen', async ({ page, data }) => {
  const name = `E2E Neukunde ${data.runId} ${Math.random().toString(36).slice(2, 6)}`
  await page.goto('/registrieren')
  await tapPin(page, data.masterPin)

  await page.getByPlaceholder('z.B. Krampfert Wohnbau GmbH').fill(name)
  await page.getByPlaceholder('z.B. buchhaltung@firma.de').fill('neukunde@example.com')
  const pins = page.getByPlaceholder('1234')
  await pins.nth(0).fill('9753')
  await pins.nth(1).fill('9753')
  await page.getByPlaceholder('z.B. Bastian-Gugel-Straße 11').fill('Teststraße 1')
  await page.getByPlaceholder('z.B. 77815').fill('77815')
  await page.getByPlaceholder('z.B. Bühl').fill('Bühl')
  await page.getByRole('button', { name: 'Konto erstellen' }).tap()

  await expect(page).toHaveURL(/\/kunde\/neuer-vorgang/)
  await expect(page.getByText('Material holen').first()).toBeVisible()
})
