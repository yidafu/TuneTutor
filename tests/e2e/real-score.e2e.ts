/**
 * 真实谱选择与光标带回归（docs/selection.md §3.3 防线 1 成员判定 v1.9）：
 * 夹具 =「刻在我心底的名字」（含 `<rest measure="yes"/>` 无 `<type>` 休止——
 * 该编码进图形层不产 notehead，成员判定漏排除时防线 1 计数错位、整谱降级、
 * 单元/组件层全绿但真实谱选择全灭，2026-10-28 浏览器取证）。
 * 链路：导入真实谱 → 单击选小节 → 双击设乐句 → Play 后光标带出现（跨过前导
 * 全小节休止静默期，m1 @ ♩=65 ≈ 3.7s；光标带规格 = PLAYING + 首 iteration 起显示）。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import { openApp, waitForNoteheads } from './helpers'

test('imported real score: selection works and playhead band appears after leading rests', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await screen.getByRole('button', { name: 'Load Score' }).click()
  await expect(screen.getByRole('dialog', { name: 'Load Score' })).toBeVisible()
  await browser.locator('input[type=file]').setInputFiles('刻在我心底的名字.musicxml')
  await expect(screen.getByRole('dialog', { name: 'Load Score' })).toBeHidden({
    timeout: 15_000,
  })
  await expect(screen.getByText('未命名乐谱').first()).toBeVisible({ timeout: 10_000 })
  await waitForNoteheads(browser)

  // 单击选小节：防线 1 计数对齐后命中恢复（v1.9 前此步在真实谱上必死）
  await browser.locator('.vf-notehead').first().click()
  await expect(browser.locator('[data-band]').first()).toBeAttached()
  await expect(
    screen.getByText(/^Measure · Measures? \d+(–\d+)? · \d+ notes?$/).first(),
  ).toBeVisible()
  await browser.keyboard.press('Escape')
  await expect(browser.locator('[data-band]').first()).toBeHidden()

  // 双击两点设乐句
  await browser.locator('.vf-notehead').first().dblclick()
  await browser.locator('.vf-notehead').nth(10).dblclick()
  await expect(
    screen.getByText(/^Phrase · Measures? \d+(–\d+)? · \d+ notes?$/).first(),
  ).toBeVisible({ timeout: 10_000 })

  // 光标带：跨过前导休止静默期后出现（首 iteration 起，audio.md §3.8）
  await browser.keyboard.press('Escape')
  const play = screen.getByRole('button', { name: 'Play' })
  await expect
    .poll(
      async () => {
        const stop = screen.getByRole('button', { name: 'Stop' })
        if ((await stop.count()) > 0 && (await stop.first().isVisible())) return true
        await play.click()
        return false
      },
      { timeout: 30_000, interval: 1_000 },
    )
    .toBe(true)
  await expect(browser.locator('[data-playhead]').first()).toBeAttached({
    timeout: 20_000,
  })
  await screen.getByRole('button', { name: 'Stop' }).click()
  await expect(play).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
})
