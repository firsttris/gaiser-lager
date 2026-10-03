import fs from 'node:fs'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import { chooseAmount, chooseMaterial, chooseSite, expect, loginAsCustomer, loginAsDriver, tapPin, test } from './support'

// Screenshots of the kiosk screens in the tablet's resolution, with the
// presentable "Muster Bau GmbH" data: in CI they are uploaded as the
// artifact "kiosk-screenshots" (and attached to the Playwright report).
const SCREENS_DIR = path.resolve('kiosk-screens')

async function saveScreen(page: Page, testInfo: TestInfo, fileName: string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done))))))
  // Let entrance animations finish.
  await page.waitForTimeout(500)
  fs.mkdirSync(SCREENS_DIR, { recursive: true })
  const file = path.join(SCREENS_DIR, fileName)
  await page.screenshot({ path: file, fullPage: true })
  await testInfo.attach(fileName, { path: file, contentType: 'image/png' })
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

test.describe.serial('Kiosk-Screenshots', () => {
  test('Kunden-Login mit Preisliste', async ({ page, data }, testInfo) => {
    await page.goto('/')
    await page.getByRole('combobox').fill(data.showcase.company.name)
    await page.getByRole('option', { name: data.showcase.company.name }).tap()
    await tapPin(page, data.showcase.company.pin.slice(0, 2))
    await expect(page.getByRole('heading', { name: 'Preisliste' })).toBeVisible()
    await expect(page.getByRole('table').first()).toBeVisible()
    await saveScreen(page, testInfo, '1-kunden-login.png')
  })

  test('Material holen nach „Wie zuletzt“', async ({ page, data }, testInfo) => {
    await loginAsCustomer(page, data.showcase.company)
    await bookMaterial(page, 'Mineralgemisch 0/32', '20', 'Hafenallee 8, Potsdam')
    await bookMaterial(page, 'Rollkies 8/16', '12,5', 'Nordring 12, Berlin')

    await page.getByText('Material holen').first().tap()
    await page.getByRole('button', { name: /Wie zuletzt/ }).tap()
    await expect(page.getByRole('button', { name: 'Vorgang anlegen' })).toBeEnabled()
    await saveScreen(page, testInfo, '2-material-holen.png')
  })

  test('LKW-Stunden nach „Wie zuletzt“', async ({ page, data }, testInfo) => {
    await loginAsDriver(page, data.showcase.driver)
    await page.getByRole('combobox').fill(data.showcase.company.name)
    await page.getByRole('option', { name: data.showcase.company.name }).tap()

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
    await saveScreen(page, testInfo, '3-lkw-stunden.png')
  })
})
