/** Nested task-board controls remain inside their card at phone and desktop widths. */
import { test, expect } from '@playwright/test'

const baseUrl = process.env.DSH_E2E_URL
if (!baseUrl) throw new Error('DSH_E2E_URL must name an authenticated DSH Web page with task-board settings')
if (process.env.DSH_E2E_STORAGE_STATE) test.use({ storageState: process.env.DSH_E2E_STORAGE_STATE })

for (const width of [390, 1440]) {
  test(`operator reaches the default model picker within the settings card at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addLocatorHandler(page.getByRole('dialog', { name: /^(预览版说明|Preview Notice)$/ }), async notice => {
      await notice.getByRole('button', { name: /^(继续|Continue)$/ }).click()
    })
    await page.addLocatorHandler(page.getByRole('dialog', { name: /^(开始使用|Get started)$/ }), async onboarding => {
      await onboarding.getByRole('button', { name: /^(关闭|Close)$/ }).click()
    })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

    const sidebarToggle = page.getByRole('button', { name: /^(打开侧栏|展开侧栏|Open sidebar)$/ })
    const accountMenu = page.getByRole('button', { name: /^(账号菜单|Account menu)$/ })
    const settingsButton = page.getByRole('button', { name: /^(设置|Settings)$/ })
    await expect(sidebarToggle.or(accountMenu).or(settingsButton).first()).toBeVisible()
    if (await sidebarToggle.isVisible()) await sidebarToggle.click()
    if (await accountMenu.isVisible()) {
      await accountMenu.click()
      await page.getByRole('menuitem', { name: /^(设置|Settings)/ }).click()
    } else {
      await settingsButton.click()
    }
    await page.getByRole('button', { name: /^(Web\s*扩展|Web Extensions)$/ }).click()
    await page.getByRole('tab', { name: /^(Web\s*插件|Web Plugins)$/ }).click()
    await page.getByRole('button', { name: /^(展开设置: 任务看板|Show settings: Task Board)$/ }).click()
    await page.getByRole('button', { name: /^(展开设置: 新建卡片默认值|Show settings: New-card defaults)$/ }).click()
    const control = page.locator('#settings-task-board-card-default-model')
    await expect(control).toBeVisible()
    await expect(control).toBeEnabled()
    await control.click({ trial: true })
    await expect.poll(async () => control.evaluate(element => {
      const card = element.closest('li')
      if (card === null) throw new Error('default model picker has no settings card')
      const field = element.getBoundingClientRect()
      const container = card.getBoundingClientRect()
      return field.left >= container.left && field.right <= container.right + 1 && field.right <= innerWidth
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('task-board-settings.png') })
  })
}
