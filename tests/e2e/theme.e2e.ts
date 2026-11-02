/**
 * 换肤端到端（docs/features/skin-switching.html §④-04）：
 * token 机制 = :root[data-theme=<id>] 重定义同名 token；OSMD 取色映射
 * applyEngravingColors（谱线/加线读 --color-staff，音符墨读 --color-ink →
 * DefaultColorMusic + DefaultColorNotehead），换肤触发乐谱重渲染（T6）。
 * 真实浏览器里验证整条链：弹层选主题 → data-theme → token 计算值变化 →
 * 重渲染后符头 path 的 fill 属性跟着变（fill 落在 .vf-notehead 内层 path 上）。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import type { Browser } from '@e2e-dev/web'
import { openApp, waitForNoteheads } from './helpers'

/** 符头 path 的 fill 属性（VexFlow 着色落点；无 path/未着色时为空串） */
function noteheadFill(browser: Browser): Promise<string> {
  return browser.evaluate(() => {
    const path = document.querySelector('.vf-notehead path')
    return path?.getAttribute('fill') ?? ''
  })
}

test('switching to Palace Red swaps the staff token and re-inks the score', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  const staffBefore = await browser.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-staff').trim(),
  )
  expect(staffBefore).not.toBe('') // paper 皮肤定义了 --color-staff: #d8d1ba
  const inkBefore = await noteheadFill(browser)
  expect(inkBefore).not.toBe('') // applyEngravingColors 已把 --color-ink 写进渲染

  // 弹层：触发按钮显示当前主题名，列表为 role=listbox
  await screen.getByRole('button', { name: /Paper Ink/ }).click()
  const listbox = screen.getByRole('listbox', { name: 'Theme' })
  await expect(listbox).toBeVisible()
  await screen.getByRole('option', { name: /Palace Red/ }).click()

  // data-theme 属性与 token 计算值立即翻转（palace --color-staff: #dbc69e ≠ paper）
  await expect
    .poll(() => browser.evaluate(() => document.documentElement.dataset.theme ?? ''))
    .toBe('palace')
  const staffAfter = await browser.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-staff').trim(),
  )
  expect(staffAfter).not.toBe(staffBefore)

  // T6 重渲染：符头 fill 从 paper 墨换成 palace 墨（DefaultColorNotehead）
  await expect.poll(() => noteheadFill(browser)).not.toBe(inkBefore)
})
