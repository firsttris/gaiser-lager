import { chooseNewSite, expect, loginAsAdmin, loginAsDriver, test, uniqueSite } from './support'

// One story across two devices: the driver books LKW-Stunden with a photo of
// the paper delivery note, the office finds it and downloads the photo.
test.describe.serial('Fahrer bucht LKW-Stunden mit Foto, Büro lädt es herunter', () => {
  const site = uniqueSite('Deponie')

  test('Fahrer: LKW-Stunden mit Lieferschein-Foto', async ({ page, data }) => {
    await loginAsDriver(page, data.driver)
    await page.getByRole('combobox').fill(data.company.name)
    await page.getByRole('option', { name: data.company.name }).tap()
    await page.getByText('LKW-Stunden').first().tap()

    await expect(page.getByRole('heading', { name: 'LKW und Stunden' })).toBeVisible()
    await page.getByRole('group', { name: 'LKW' }).getByRole('button').first().tap()
    await page.getByRole('group', { name: 'Stunden' }).getByRole('button', { name: '4', exact: true }).tap()
    await chooseNewSite(page, site)
    await page.locator('input[type="file"]').setInputFiles('e2e/files/lieferschein.jpg')
    await expect(page.getByText(/Std\. .* · 1 Foto/)).toBeVisible()

    await page.getByRole('button', { name: 'Vorgang anlegen' }).tap()
    await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()
    await expect(page.getByText('1 Lieferschein-Foto wurde ans Büro übertragen.')).toBeVisible({ timeout: 30_000 })
  })

  test('Admin: Vorgang mit Foto finden und Foto herunterladen', async ({ page, data }) => {
    await loginAsAdmin(page, data.admin)
    await page.goto('/admin/vorgaenge')
    const row = page.getByRole('row').filter({ hasText: site })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: /^Dateien:/ }).tap()
    await page.getByRole('menuitem', { name: /Lieferschein-Fotos/ }).tap()
    const dialog = page.getByRole('dialog', { name: 'Lieferschein-Fotos' })
    await expect(dialog.getByRole('img', { name: 'Lieferschein-Foto 1' })).toBeVisible()

    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Herunterladen' }).tap()
    expect((await download).suggestedFilename()).toMatch(/-Foto-1\.(jpg|webp)$/)
  })
})
