/** Nested task-board controls remain inside their card at phone and desktop widths. */
import { test, expect } from '@playwright/test'

const baseUrl = process.env.DSH_E2E_URL
if (!baseUrl) throw new Error('DSH_E2E_URL must name an authenticated DSH Web page with task-board settings')
if (process.env.DSH_E2E_STORAGE_STATE) test.use({ storageState: process.env.DSH_E2E_STORAGE_STATE })

for (const width of [390, 1440]) {
  test(`operator reaches task acceptance controls within the settings card at ${width}px`, async ({ page }) => {
    // Given a mounted task-board card, when the operator expands task acceptance, then its controls fit the card and viewport.
    await page.setViewportSize({ width, height: 900 })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    const accountMenu = page.getByRole('button', { name: /^(账号菜单|Account menu)$/ })
    if (await accountMenu.isVisible()) {
      await accountMenu.click()
      await page.getByRole('menuitem', { name: /^(设置|Settings)/ }).click()
    } else {
      await page.getByRole('button', { name: /^(设置|Settings)$/ }).click()
    }
    await page.getByRole('button', { name: /^(Web\s*插件|Web Plugins)$/ }).click()
    await page.getByRole('button', { name: /^(展开设置: 任务看板|Show settings: Task Board)$/ }).click()
    await page.getByRole('button', { name: /^(展开设置: 任务验收|Show settings: Task acceptance)$/ }).click()
    const control = page.locator('#settings-task-board-goal-verification')
    await expect(control).toBeVisible()
    await expect.poll(async () => control.evaluate(element => {
      const card = element.closest('li')
      if (card === null) throw new Error('task acceptance control has no settings card')
      const field = element.getBoundingClientRect()
      const container = card.getBoundingClientRect()
      return field.left >= container.left && field.right <= container.right + 1 && field.right <= innerWidth
    })).toBe(true)
  })
}
