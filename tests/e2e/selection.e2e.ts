/**
 * 选择交互端到端（docs/selection.md §4、docs/features/text-selection.md §3）：
 * - 单击音符 → 选小节（零延迟路径）；
 * - 双击两个音符 → 乐句区间（原生 dblclick 路径，桌面端；hitFromClientPoint 坐标命中，
 *   pointer capture 会把 dblclick 的 target 重定向到 stage，e2e 抓出的回归）；
 * - 空白处拖拽框选 → 拖拽中实时预览（§4.2 v1.6）、抬手提交。
 * 覆盖层锚点：[data-band] 行带、[data-note-highlight] 音符高亮（ScoreSelectionOverlay）。
 * 摘要文本同时出现在覆盖层 pill 与 SelectionInfo 页脚，断言一律 .first()。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import type { Browser } from '@e2e-dev/web'
import { noteheadBoxes, openApp, waitForNoteheads } from './helpers'

/** 第 index 个音符头的中心（client 坐标），供 mouse 事件换算 */
async function noteheadCenter(browser: Browser, index: number): Promise<{ x: number; y: number }> {
  const boxes = await noteheadBoxes(browser)
  const box = boxes.at(index)
  if (box === undefined) throw new Error(`notehead #${index} not found (${boxes.length} rendered)`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('clicking a notehead selects its measure', async ({ app, screen, browser }) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await browser.locator('.vf-notehead').first().click()

  await expect(browser.locator('[data-band]').first()).toBeAttached()
  await expect(browser.locator('[data-note-highlight]').first()).toBeAttached()
  // SelectionInfo 摘要（describeSelection：kind · measures · noteCount）
  await expect(screen.getByText(/^Measure · Measures? \d+(–\d+)? · \d+ notes?$/).first()).toBeVisible()
})

test('double-clicking two noteheads sets a phrase loop', async ({ app, screen, browser }) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await browser.locator('.vf-notehead').first().dblclick()
  await browser.locator('.vf-notehead').nth(10).dblclick()

  await expect(
    screen.getByText(/^Phrase · Measures? \d+(–\d+)? · \d+ notes?$/).first(),
  ).toBeVisible({ timeout: 10_000 })
})

test('dragging on empty space previews live and commits on release', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  const boxes = await noteheadBoxes(browser)
  expect(boxes.length).toBeGreaterThan(4)
  const first = await noteheadCenter(browser, 0)
  const third = await noteheadCenter(browser, 2)
  // 起板点取首个音符头左侧空白（音符上起板不进框选，text-selection.md §3.4），
  // 与首个音符头拉开距离以越过 4px slop
  const start = { x: first.x - 60, y: first.y }
  const stop = { x: third.x + 10, y: third.y }

  await browser.mouse.move(start.x, start.y)
  await browser.mouse.down()
  await browser.mouse.move((start.x + stop.x) / 2, stop.y)

  // 拖拽中实时预览：行带已出现、且尚未提交（SelectionInfo 仍是引导文案）
  await expect(browser.locator('[data-band]').first()).toBeAttached({ timeout: 10_000 })

  await browser.mouse.up()

  // 抬手提交：框选摘要出现（describeSelection kind=box），行带保持
  await expect(
    screen.getByText(/^Box selection · Measures? \d+(–\d+)? · \d+ notes?$/).first(),
  ).toBeVisible({ timeout: 10_000 })
  await expect(browser.locator('[data-band]').first()).toBeAttached()
})
