import fs from 'node:fs'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import {
  chooseAmount,
  chooseMaterial,
  chooseSite,
  expect,
  type FontScale,
  loginAsAdmin,
  loginAsCustomer,
  loginAsDriver,
  tapPin,
  test,
  useFontScale,
} from './support'

// Screenshots of every page in the tablet's resolution, so a look at the CI
// artifact "screenshots" shows whether everything looks right. Folders:
//   vorzeigen/       presentable screens with "Muster Bau GmbH" (for customers)
//   normal/…         all pages at the default text size
//   gross/…          the kiosk pages (customer, driver) at A++
const SCREENS_DIR = path.resolve('screenshots')

async function shoot(page: Page, testInfo: TestInfo, file: string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done))))),
  )
  // Let entrance animations finish.
  await page.waitForTimeout(400)
  const target = path.join(SCREENS_DIR, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  await page.screenshot({ path: target, fullPage: true })
  await testInfo.attach(file, { path: target, contentType: 'image/png' })
}

async function bookMaterial(page: Page, material: string, amount: string, site: string) {
  await page.getByText('Material holen').first().tap()
  await chooseMaterial(page, material)
  await chooseAmount(page, 'Menge', amount)
  await chooseSite(page, site)
  await page.getByRole('button', { name: 'Vorgang anlegen' }).tap()
  await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()
  await page.getByRole('link', { name: 'Neuen Vorgang anlegen' }).tap()
}

async function selectCompany(page: Page, name: string) {
  await page.getByRole('combobox').fill(name)
  await page.getByRole('option', { name }).tap()
}

test.describe.serial('Vorzeigebilder (Muster Bau GmbH)', () => {
  test('Kunden-Login mit Preisliste', async ({ page, data }, testInfo) => {
    await page.goto('/')
    await selectCompany(page, data.showcase.company.name)
    await tapPin(page, data.showcase.company.pin.slice(0, 2))
    await expect(page.getByRole('table').first()).toBeVisible()
    await shoot(page, testInfo, 'vorzeigen/1-kunden-login.png')
  })

  test('Material holen nach „Wie zuletzt“', async ({ page, data }, testInfo) => {
    await loginAsCustomer(page, data.showcase.company)
    await bookMaterial(page, 'Mineralgemisch 0/32', '20', 'Hafenallee 8, Potsdam')
    await bookMaterial(page, 'Rollkies 8/16', '12,5', 'Nordring 12, Berlin')
    await page.getByText('Material holen').first().tap()
    await page.getByRole('button', { name: /Wie zuletzt/ }).tap()
    await expect(page.getByRole('button', { name: 'Vorgang anlegen' })).toBeEnabled()
    await shoot(page, testInfo, 'vorzeigen/2-material-holen.png')
  })

  test('LKW-Stunden nach „Wie zuletzt“', async ({ page, data }, testInfo) => {
    await loginAsDriver(page, data.showcase.driver)
    await selectCompany(page, data.showcase.company.name)
    await page.getByText('LKW-Stunden').first().tap()
    await page.getByRole('group', { name: 'LKW' }).getByRole('button').first().tap()
    await chooseAmount(page, 'Stunden', '4')
    await chooseSite(page, 'Nordring 12, Berlin')
    await page.getByRole('button', { name: 'Vorgang anlegen' }).tap()
    await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()
    await page.getByRole('button', { name: 'Neuen Vorgang anlegen' }).tap()
    await page.getByText('LKW-Stunden').first().tap()
    await page.getByRole('button', { name: /Wie zuletzt/ }).tap()
    await expect(page.getByRole('button', { name: 'Vorgang anlegen' })).toBeEnabled()
    await shoot(page, testInfo, 'vorzeigen/3-lkw-stunden.png')
  })
})

const SCALE_FOLDERS: { scale: FontScale; folder: string; kioskOnly: boolean }[] = [
  { scale: 'normal', folder: 'normal', kioskOnly: false },
  { scale: 'xlarge', folder: 'gross', kioskOnly: true },
]

for (const { scale, folder, kioskOnly } of SCALE_FOLDERS) {
  test.describe(`Alle Seiten (${folder})`, () => {
    test.beforeEach(async ({ page }) => useFontScale(page, scale))

    test('Öffentlich', async ({ page, data }, testInfo) => {
      await page.goto('/')
      await expect(page.getByRole('table').first()).toBeVisible()
      await shoot(page, testInfo, `${folder}/oeffentlich/01-start-login.png`)
      await page.goto('/registrieren')
      await shoot(page, testInfo, `${folder}/oeffentlich/02-registrieren-master-pin.png`)
      await tapPin(page, data.masterPin)
      await expect(page.getByRole('button', { name: 'Konto erstellen' })).toBeVisible()
      await shoot(page, testInfo, `${folder}/oeffentlich/03-registrieren-daten.png`)
      await page.goto('/mitarbeiter')
      await shoot(page, testInfo, `${folder}/oeffentlich/04-fahrer-namen.png`)
      await page.getByRole('button', { name: data.driver.name }).tap()
      await shoot(page, testInfo, `${folder}/oeffentlich/05-fahrer-pin.png`)
      if (kioskOnly) return
      await page.goto('/preisliste')
      await shoot(page, testInfo, `${folder}/oeffentlich/06-preisliste.png`)
      await page.goto('/admin')
      await shoot(page, testInfo, `${folder}/oeffentlich/07-admin-login.png`)
      await page.goto('/passwort-vergessen')
      await shoot(page, testInfo, `${folder}/oeffentlich/08-passwort-vergessen.png`)
    })

    test('Kunde', async ({ page, data }, testInfo) => {
      await loginAsCustomer(page, data.company)
      await shoot(page, testInfo, `${folder}/kunde/01-neuer-vorgang.png`)
      await page.getByText('Material holen').first().tap()
      await shoot(page, testInfo, `${folder}/kunde/02-material-holen-leer.png`)
      await chooseAmount(page, 'Menge', '10')
      await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Andere …' }).tap()
      await shoot(page, testInfo, `${folder}/kunde/03-mengen-dialog.png`)
      await page.getByRole('button', { name: 'Abbrechen' }).tap()
      await page.getByRole('button', { name: /Baustelle …|Baustelle wählen …/ }).tap()
      await page.getByLabel('Baustelle suchen oder neu eingeben').fill(`Testweg ${data.runId}`)
      await shoot(page, testInfo, `${folder}/kunde/04-baustellen-dialog.png`)
      await page.getByRole('button', { name: /als neue Baustelle anlegen/ }).tap()
      await shoot(page, testInfo, `${folder}/kunde/05-material-holen-ausgefuellt.png`)
      await page.getByRole('button', { name: 'Vorgang anlegen' }).tap()
      await expect(page.getByText('Vorgang erfolgreich angelegt')).toBeVisible()
      await shoot(page, testInfo, `${folder}/kunde/06-vorgang-angelegt.png`)
      await page.goto('/kunde/neuer-vorgang/dropoff')
      await shoot(page, testInfo, `${folder}/kunde/07-material-bringen.png`)
      await page.goto('/kunde/vorgaenge')
      await shoot(page, testInfo, `${folder}/kunde/08-vorgaenge.png`)
      await page.goto('/kunde/rechnungen')
      await shoot(page, testInfo, `${folder}/kunde/09-rechnungen.png`)
    })

    test('Fahrer', async ({ page, data }, testInfo) => {
      await loginAsDriver(page, data.driver)
      await shoot(page, testInfo, `${folder}/fahrer/01-firma-waehlen.png`)
      await selectCompany(page, data.company.name)
      await shoot(page, testInfo, `${folder}/fahrer/02-vorgang-waehlen.png`)
      await page.getByText('LKW-Stunden').first().tap()
      await shoot(page, testInfo, `${folder}/fahrer/03-lkw-stunden-leer.png`)
      await page.getByRole('group', { name: 'LKW' }).getByRole('button').first().tap()
      await chooseAmount(page, 'Stunden', '4')
      await chooseSite(page, `Deponie ${data.runId}`)
      await page.locator('input[type="file"]').setInputFiles('e2e/files/lieferschein.jpg')
      await shoot(page, testInfo, `${folder}/fahrer/04-lkw-stunden-mit-foto.png`)
      await page.getByRole('button', { name: 'Vorgang anlegen' }).tap()
      await expect(page.getByText(/Lieferschein-Foto wurde ans Büro übertragen/)).toBeVisible({ timeout: 30_000 })
      await shoot(page, testInfo, `${folder}/fahrer/05-vorgang-angelegt.png`)
      await page.goto('/mitarbeiter/buchungen')
      await shoot(page, testInfo, `${folder}/fahrer/06-meine-buchungen.png`)
    })

    if (!kioskOnly) {
      test('Admin', async ({ page, data }, testInfo) => {
        await loginAsAdmin(page, data.admin)
        const pages: [string, string][] = [
          ['/admin', '01-start'],
          ['/admin/neuer-vorgang', '02-neuer-vorgang'],
          ['/admin/vorgaenge', '03-vorgaenge'],
          ['/admin/rechnungen', '04-rechnungen'],
          ['/admin/material', '05-material'],
          ['/admin/lkw', '06-lkw'],
          ['/admin/kunden', '07-kunden'],
          ['/admin/baustellen', '08-baustellen'],
          ['/admin/mitarbeiter', '09-mitarbeiter'],
          ['/admin/e-mail', '10-e-mail'],
          ['/admin/einstellungen', '11-einstellungen'],
        ]
        for (const [url, name] of pages) {
          await page.goto(url)
          await shoot(page, testInfo, `${folder}/admin/${name}.png`)
        }
      })
    }
  })
}
