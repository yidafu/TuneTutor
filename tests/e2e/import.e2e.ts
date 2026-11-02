/**
 * 乐谱导入端到端（docs/musicxml.md 导入管线 + docs/tech.md §7.3 启动恢复）：
 * 弹层选本地 MusicXML → processFile 解析 → OSMD 重渲染 → 标题/谱面更新 →
 * IndexedDB 历史 → 刷新后最近文件自动恢复。
 * 夹具：musicxml/连音符.musicxml（真实谱，含连音标记，标题「连音符」；
 * 标题同时出现在 ScoreInfo 与 OSMD 谱面 svg 文本里，断言用 .first()）。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import { openApp, waitForNoteheads } from './helpers'

test('imports a MusicXML file through the loader modal and restores it after reload', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await screen.getByRole('button', { name: 'Load Score' }).click()
  await expect(screen.getByRole('dialog', { name: 'Load Score' })).toBeVisible()

  // 隐藏 input（aria-hidden 但可 setInputFiles）：真实文件走完整 processFile 管线
  await browser.locator('input[type=file]').setInputFiles('musicxml/连音符.musicxml')

  // 导入完成：弹层关闭、标题与谱面换成新谱
  await expect(screen.getByRole('dialog', { name: 'Load Score' })).toBeHidden({
    timeout: 10_000,
  })
  await expect(screen.getByText('连音符').first()).toBeVisible({ timeout: 10_000 })
  await waitForNoteheads(browser)

  // IndexedDB 文件历史：刷新后启动恢复最近文件（tech.md §7.3）
  await browser.reload()
  await expect(screen.getByText('连音符').first()).toBeVisible({ timeout: 15_000 })
  await waitForNoteheads(browser)
})
