/**
 * 启动冒烟 + 页面导航（docs/tech.md §2 页面路由：/ 乐谱页、/audio 原曲页）。
 * demo 谱（twinkle-twinkle）构建期内联、启动即渲染：标题来自
 * workTitle ?? movementTitle（musicxml-io 实测契约，docs/tech.md §13）。
 * 标题同时出现在 ScoreInfo 与 OSMD 谱面 svg 文本里，断言用 .first()。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import { openApp, waitForNoteheads } from './helpers'

test('boots the score page with the demo score rendered', async ({ app, screen, browser }) => {
  await openApp(app, browser)

  await expect(screen.getByRole('link', 'Score')).toBeVisible()
  await expect(screen.getByRole('link', 'Original Audio')).toBeVisible()
  await expect(screen.getByText('Twinkle Twinkle Little Star').first()).toBeVisible()

  // OSMD 真实渲染：svg + 音符头 DOM（选择域 DOM zip 配对的锚点，selection.md §3.2）
  await waitForNoteheads(browser)
  await expect(browser.locator('svg').first()).toBeAttached()
})

test('navigates to the audio page and back', async ({ app, screen, browser }) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await screen.getByRole('link', 'Original Audio').click()
  // 空库原曲页的导入入口即拖放区（弹层未开时无「Audio Library」标题）
  await expect(screen.getByText('Drop an audio file here, or browse files')).toBeVisible()

  await screen.getByRole('link', 'Score').click()
  await waitForNoteheads(browser)
  await expect(screen.getByText('Twinkle Twinkle Little Star').first()).toBeVisible()
})
