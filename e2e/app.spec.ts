import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { PNG } from 'pngjs'

interface Fixture {
  rack: string
  rows: string[]
}

const expectedFixtures = JSON.parse(fs.readFileSync(new URL('../src/test/fixtures/expected.json', import.meta.url), 'utf8')) as Record<string, Fixture>

async function expectParsedGame(page: import('@playwright/test').Page, fixture: Fixture) {
  await expect(page.getByRole('heading', { name: /check the board/i })).toBeVisible({ timeout: 90_000 })
  const rack = await page.getByLabel(/rack tile/i).evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value).join(''),
  )
  expect(rack).toBe(fixture.rack)
  const actual = await page.getByRole('gridcell').evaluateAll((cells) => cells.map((cell) => {
    const label = cell.getAttribute('aria-label') ?? ''
    const value = label.split(': ')[1]?.split(',')[0] ?? 'empty'
    return /^[A-Z]$/.test(value) ? value : '.'
  }))
  const rows = Array.from({ length: 15 }, (_, row) => actual.slice(row * 15, row * 15 + 15).join(''))
  expect(rows).toEqual(fixture.rows)
}

function syntheticScreenshot(name: string): Buffer {
  const output = new PNG({ width: 1320, height: 2868 })
  output.data.fill(255)
  const board = PNG.sync.read(fs.readFileSync(new URL(`../src/test/fixtures/${name}-board.png`, import.meta.url)))
  const rack = PNG.sync.read(fs.readFileSync(new URL(`../src/test/fixtures/${name}-rack.png`, import.meta.url)))
  PNG.bitblt(board, output, 0, 0, board.width, board.height, 21, 795)
  PNG.bitblt(rack, output, 0, 0, rack.width, rack.height, 0, 2245)
  return PNG.sync.write(output)
}

test('manual board can be edited and solved', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /enter a board manually/i }).click()
  await page.getByRole('gridcell', { name: /^H8:/ }).click()
  await page.getByRole('button', { name: 'A', exact: true }).click()
  const rack = page.getByLabel(/rack tile/i)
  await rack.nth(0).fill('C')
  await rack.nth(1).fill('T')
  await page.getByRole('button', { name: /find top 10 moves/i }).click()
  await expect(page.getByRole('heading', { name: /your best moves/i })).toBeVisible({ timeout: 60_000 })
  expect(await page.locator('.move-card').count()).toBeGreaterThan(0)
})

for (const name of ['1917', '1918']) {
  test(`anonymized ${name} fixture parses its board and rack`, async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles({
      name: `${name}.png`,
      mimeType: 'image/png',
      buffer: syntheticScreenshot(name),
    })
    await expectParsedGame(page, expectedFixtures[name])
  })
}

test('real screenshot enters the confirmation flow', async ({ page }) => {
  test.skip(!process.env.WWF_SCREENSHOT, 'Set WWF_SCREENSHOT to exercise local OCR against a private full screenshot.')
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(process.env.WWF_SCREENSHOT as string)
  await expect(page.getByRole('heading', { name: /check the board/i })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Screenshot detected')).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(225)
  if (process.env.WWF_EXPECTED_RACK) {
    const values = await page.getByLabel(/rack tile/i).evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value).join(''),
    )
    expect(values).toBe(process.env.WWF_EXPECTED_RACK)
  }
  if (process.env.WWF_EXPECTED_BOARD) {
    const expected = process.env.WWF_EXPECTED_BOARD.split('/')
    const actual = await page.getByRole('gridcell').evaluateAll((cells) => cells.map((cell) => {
      const label = cell.getAttribute('aria-label') ?? ''
      const value = label.split(': ')[1]?.split(',')[0] ?? 'empty'
      return /^[A-Z]$/.test(value) ? value : '.'
    }))
    const rows = Array.from({ length: 15 }, (_, row) => actual.slice(row * 15, row * 15 + 15).join(''))
    expect(rows).toEqual(expected)
  }
  if (process.env.WWF_SOLVE) {
    await page.getByRole('button', { name: /find top 10 moves/i }).click()
    await expect(page.getByRole('heading', { name: /your best moves/i })).toBeVisible({ timeout: 60_000 })
    const moveCount = await page.locator('.move-card').count()
    expect(moveCount).toBeGreaterThan(0)
    expect(moveCount).toBeLessThanOrEqual(10)
  }
})
