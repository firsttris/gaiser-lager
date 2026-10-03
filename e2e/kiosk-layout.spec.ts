import { FONT_SCALES, chooseAmount, expect, expectCleanLayout, loginAsCustomer, loginAsDriver, test, useFontScale } from './support'

// On the tablet's resolution and at every text size (A, A+, A++): nothing
// scrolls sideways, no tap targets overlap, no label spills out of its button.
for (const scale of FONT_SCALES) {
  test.describe(`Layout bei Schriftgröße ${scale}`, () => {
    test.beforeEach(async ({ page }) => useFontScale(page, scale))

    test('Startseite, Registrierung, Fahrer-Anmeldung', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Preisliste' })).toBeVisible()
      await expectCleanLayout(page, 'Kunden-Login')
      await page.goto('/registrieren')
      await expectCleanLayout(page, 'Registrierung')
      await page.goto('/mitarbeiter')
      await expectCleanLayout(page, 'Fahrer-Anmeldung')
    })

    test('Kunde: Vorgang anlegen und Vorgänge', async ({ page, data }) => {
      await loginAsCustomer(page, data.company)
      await expectCleanLayout(page, 'Neuer Vorgang')
      await page.getByText('Material holen').first().tap()
      await chooseAmount(page, 'Menge', '10')
      await expectCleanLayout(page, 'Material und Menge')
      await page.getByRole('button', { name: /Baustelle …|Baustelle wählen …/ }).tap()
      await expectCleanLayout(page, 'Baustellen-Dialog')
      await page.getByRole('button', { name: 'Abbrechen' }).tap()
      await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Andere …' }).tap()
      await expectCleanLayout(page, 'Mengen-Dialog')
      await page.goto('/kunde/vorgaenge')
      await expectCleanLayout(page, 'Vorgänge')
    })

    test('Fahrer: LKW-Stunden', async ({ page, data }) => {
      await loginAsDriver(page, data.driver)
      await page.getByRole('combobox').fill(data.company.name)
      await page.getByRole('option', { name: data.company.name }).tap()
      await expectCleanLayout(page, 'Fahrer: Vorgang wählen')
      await page.getByText('LKW-Stunden').first().tap()
      await expectCleanLayout(page, 'LKW und Stunden')
    })
  })
}
