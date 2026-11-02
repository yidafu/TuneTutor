/**
 * e2e 共享助手（tests/e2e/*.e2e.ts）。
 * 断言标签全部走 en-US 文案：打开前用 initScript 把语言钉死在 en-US
 * （I18nProvider 检测顺序：localStorage → navigator.languages → en-US，
 * 无痕上下文里 navigator 值随宿主机变化，必须显式钉住）。
 */
import { expect } from 'e2e'
import type { Browser } from '@e2e-dev/web'
import type { TestFixtures } from 'e2e'

type App = TestFixtures['app']

/** Vite base 前缀（GitHub Pages 部署约束，e2e.config.ts 的 url 同源） */
export const BASE_PATH = '/TuneTutor/'

/**
 * 打开应用：钉住语言 → 按绝对路径打开（HashRouter 路由走 hash 段）。
 * hash 形如 ''、'#/audio'。
 */
export async function openApp(app: App, browser: Browser, hash = ''): Promise<void> {
  // initScript 在 about:blank（opaque origin）上 localStorage 访问会抛 SecurityError，
  // 静默吞掉：真实文档上写入正常生效（钉住 en-US）
  await browser.addInitScript(() => {
    try {
      localStorage.setItem('note-slice-language', 'en-US')
    } catch {
      /* about:blank 无存储权限，忽略 */
    }
  })
  await app.open(`${BASE_PATH}/${hash}`)
}

/** 等待 OSMD 渲染出真实音符头（demo 谱启动即渲染，几何就绪是交互前提） */
export async function waitForNoteheads(browser: Browser): Promise<void> {
  await expect(browser.locator('.vf-notehead').first()).toBeAttached({ timeout: 15_000 })
}

/** 视口内音符头盒（client 坐标），供 mouse 拖拽/点击换算 */
export function noteheadBoxes(browser: Browser): Promise<
  readonly { x: number; y: number; width: number; height: number }[]
> {
  return browser.evaluate(() =>
    Array.from(document.querySelectorAll('.vf-notehead')).map((el) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
}
