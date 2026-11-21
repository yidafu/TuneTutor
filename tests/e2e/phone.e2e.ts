/**
 * 手机竖屏布局端到端（docs/features/phone-compat.md，PRD G18）：
 * 引擎视口钉 390×844（iPhone 14 基准）。指针媒体（pointer/hover）无法仿真
 * （WebOptions 只支持 colorScheme/reducedMotion），coarse 专属规则不在本层验，
 * 由 CSS 文本断言（tests/themes）+ 真机手测（test-cases TC-MAN-05）兜底。
 * 本层验宽度布局不变式：无横向溢出、弹层/弹窗钳在视口内、关键操作可达。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import type { Browser } from '@e2e-dev/web'
import { openApp, waitForNoteheads } from './helpers'

const PHONE = { width: 390, height: 844 }

type Box = {
  left: number
  right: number
  top: number
  bottom: number
}

/** 盒完全落在视口内（2px 容差；几何在页面里取，判定在测试侧做） */
function inViewport(box: Box, viewport: { width: number; height: number } = PHONE): boolean {
  return box.left >= -2 && box.right <= viewport.width + 2 && box.top >= -2 && box.bottom <= viewport.height + 2
}

/** 无横向溢出：文档与视口同宽（页面侧执行，不得闭包外部变量） */
function noHorizontalOverflow(): boolean {
  return document.documentElement.scrollWidth <= window.innerWidth
}

/** 按选择器取首个元素的视口盒（页面侧序列化回来的纯对象） */
function boxOf(browser: Browser, selector: string): Promise<Box | null> {
  return browser.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (element === null) return null
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return { left, right, top, bottom }
  }, selector)
}

/**
 * 合成 1 秒 440Hz 单声道 16-bit PCM WAV（无仓库音频夹具；写进 gitignore 的 .e2e/），
 * 长文件名用于触发原曲页头部行折行（phone-compat P8）。
 */
function writeToneWav(): string {
  const sampleRate = 8000
  const samples = sampleRate
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  mkdirSync('.e2e/fixtures', { recursive: true })
  const path = '.e2e/fixtures/a-rather-long-practice-recording-name-for-the-phone-layout.wav'
  writeFileSync(path, Buffer.concat([header, data]))
  return path
}

test.beforeEach(async ({ browser }) => {
  await browser.setViewport(PHONE)
})

test('score page: no horizontal overflow, beat grid on one row, transport reachable', async ({
  app,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  expect(await browser.evaluate(noHorizontalOverflow)).toBe(true)

  // 空拍 8 键一行等分（P5 网格）：中线间距一致，首尾都在视口内
  const beatCenters = await browser.evaluate(() =>
    Array.from(document.querySelectorAll('[role="group"][aria-label="Gap beats"] button'))
      .map((btn) => {
        const { left, right, top } = btn.getBoundingClientRect()
        return { x: (left + right) / 2, top }
      })
      .sort((a, b) => a.x - b.x),
  )
  expect(beatCenters).toHaveLength(8)
  expect(new Set(beatCenters.map((c) => Math.round(c.top))).size).toBe(1) // 同一行
  const gaps = beatCenters.slice(1).map((c, i) => c.x - beatCenters[i]!.x)
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
  expect(beatCenters[0]!.x).toBeGreaterThan(0)
  expect(beatCenters.at(-1)!.x).toBeLessThan(PHONE.width)

  // 走带钮在视口内（吸底控制条不被挤出）
  const play = await boxOf(browser, 'button[aria-label="Play"]')
  expect(play).not.toBeNull()
  expect(inViewport(play!)).toBe(true)

  // 手机隐藏渲染器说明，框选开关在非触屏（e2e 无 coarse）下同样隐藏
  const hidden = await browser.evaluate(() => {
    const toggle = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Box select'))
    return toggle === undefined ? 'absent' : getComputedStyle(toggle).display
  })
  expect(hidden).toBe('none')
})

test('popovers are clamped inside the phone viewport (theme / language / instrument / metronome)', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  // 皮肤：272px 弹层右对齐于贴左缘的触发钮，未钳制时左沿在屏外
  await screen.getByRole('button', { name: /Paper Ink/ }).click()
  await expect(screen.getByRole('listbox', { name: 'Theme' })).toBeVisible()
  const theme = await browser.evaluate(() => {
    const pop = document.querySelector('[role="listbox"][aria-label="Theme"]')?.parentElement
    if (!pop) return null
    const { left, right, top, bottom } = pop.getBoundingClientRect()
    return { left, right, top, bottom }
  })
  expect(theme).not.toBeNull()
  expect(inViewport(theme!)).toBe(true)
  await screen.getByRole('button', { name: /Paper Ink/ }).click()

  // 语言
  await screen.getByRole('button', { name: 'English' }).click()
  const language = await boxOf(browser, '[role="listbox"]')
  expect(language).not.toBeNull()
  expect(inViewport(language!)).toBe(true)
  await screen.getByRole('button', { name: 'English' }).click()

  // 乐器（12 项长列表：宽钳 + 高钳内滚）
  await screen.getByRole('button', { name: /Piano/ }).click()
  const instrument = await boxOf(browser, '[role="listbox"]')
  expect(instrument).not.toBeNull()
  expect(inViewport(instrument!)).toBe(true)
  await screen.getByRole('button', { name: /Piano/ }).click()

  // 节拍器设置（向上弹出）
  await screen.getByRole('button', { name: 'Metronome settings' }).click()
  const metronome = await boxOf(browser, '[data-settings-popover]')
  expect(metronome).not.toBeNull()
  expect(inViewport(metronome!)).toBe(true)
  expect(await browser.evaluate(noHorizontalOverflow)).toBe(true)
})

test('file modal: re-fits a short viewport, close button stays reachable', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  await screen.getByRole('button', { name: 'Load Score' }).click()
  const dialog = screen.getByRole('dialog', { name: 'Load Score' })
  await expect(dialog).toBeVisible()

  // 横屏级矮视口：内容高于可用高度，弹窗钳在视口内、最近文件区收缩内滚（P7）
  const short = { width: 390, height: 300 }
  await browser.setViewport(short)
  await expect
    .poll(async () => {
      const box = await boxOf(browser, '[role="dialog"]')
      return box !== null && inViewport(box, short)
    })
    .toBe(true)
  const close = await boxOf(browser, 'button[aria-label="Close"]')
  expect(close).not.toBeNull()
  expect(inViewport(close!, short)).toBe(true)

  await screen.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('audio page (loaded): header wraps, tempo shares the transport row, nothing overflows', async ({
  app,
  screen,
  browser,
}) => {
  await openApp(app, browser, '#/audio')
  await expect(screen.getByText('Drop an audio file here, or browse files')).toBeVisible()
  expect(await browser.evaluate(noHorizontalOverflow)).toBe(true)

  await browser.locator('input[type=file]').setInputFiles(writeToneWav())
  await expect(screen.getByRole('button', { name: 'Audio Library' })).toBeVisible({ timeout: 15_000 })
  await expect(screen.getByRole('button', { name: 'Zoom in waveform' })).toBeVisible()

  expect(await browser.evaluate(noHorizontalOverflow)).toBe(true)

  // 头部两个操作钮完整可见（长文件名不再把它们挤出卡片）
  for (const name of ['Audio Library', 'Remove audio']) {
    const box = await browser.evaluate((label) => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(label))
      if (!btn) return null
      const { left, right, top, bottom } = btn.getBoundingClientRect()
      return { left, right, top, bottom }
    }, name)
    expect(box, name).not.toBeNull()
    expect(inViewport(box!), name).toBe(true)
  }

  // 速度提到首位与走带同排（order -1），空拍整行在下
  const rows = await browser.evaluate(() => {
    const play = document.querySelector('button[aria-label="Play"]')!.getBoundingClientRect()
    const tempo = document.querySelector('input[type="range"][aria-label="Tempo"]')!.getBoundingClientRect()
    const beats = document.querySelector('[role="group"][aria-label="Gap beats"]')!.getBoundingClientRect()
    return {
      playMid: (play.top + play.bottom) / 2,
      tempoMid: (tempo.top + tempo.bottom) / 2,
      tempoLeft: tempo.left,
      playLeft: play.left,
      beatsTop: beats.top,
      playBottom: play.bottom,
    }
  })
  expect(Math.abs(rows.playMid - rows.tempoMid)).toBeLessThan(24)
  expect(rows.tempoLeft).toBeLessThan(rows.playLeft)
  expect(rows.beatsTop).toBeGreaterThanOrEqual(rows.playBottom - 2)
})

/** 旋转重排（phone-compat P12）：宽 → 窄后容器必须缩回，ResizeObserver 才会触发重排 */
test('rotating back to portrait shrinks the score container and re-wraps', async ({ app, browser }) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  const widths = (): Promise<{ container: number; svg: number }> =>
    browser.evaluate(() => {
      const stage = document.querySelector('[data-osmd-stage]') as HTMLElement | null
      const svg = stage?.querySelector('svg') ?? null
      return {
        container: stage?.clientWidth ?? 0,
        svg: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      }
    })

  const portrait = await widths()
  expect(portrait.svg).toBeLessThanOrEqual(portrait.container + 1)

  await browser.setViewport({ width: 1000, height: 700 })
  await expect.poll(async () => (await widths()).svg, { timeout: 5_000 }).toBeGreaterThan(portrait.svg + 300)

  await browser.setViewport(PHONE)
  // 列轨 minmax(0,1fr)：容器先缩回，防抖重排后 SVG 跟随回落到容器宽内
  await expect.poll(async () => (await widths()).container, { timeout: 5_000 }).toBeLessThanOrEqual(
    portrait.container + 1,
  )
  await expect.poll(async () => (await widths()).svg, { timeout: 5_000 }).toBeLessThanOrEqual(
    portrait.container + 1,
  )
  expect(await browser.evaluate(noHorizontalOverflow)).toBe(true)
})
