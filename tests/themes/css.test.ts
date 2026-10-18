import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES } from '@/themes'

/** skin-switching v1.1 §③ Token 全表的 34 个颜色 token（--color-*） */
const COLOR_TOKENS = [
  '--color-canvas',
  '--color-surface',
  '--color-surface-2',
  '--color-surface-3',
  '--color-line',
  '--color-line-strong',
  '--color-header',
  '--color-backdrop',
  '--color-fg',
  '--color-fg-2',
  '--color-fg-3',
  '--color-ink',
  '--color-ink-hover',
  '--color-ink-2',
  '--color-cream',
  '--color-verm',
  '--color-verm-deep',
  '--color-verm-soft',
  '--color-verm-line',
  '--color-verm-line-strong',
  '--color-gold',
  '--color-gold-bright',
  '--color-moss',
  '--color-clay',
  '--color-clay-soft',
  '--color-clay-line',
  '--color-paper',
  '--color-staff',
  '--color-barline',
  '--color-track',
  '--color-wash',
  '--color-wave-bg',
  '--color-wave-bar-a',
  '--color-wave-bar-b',
]

const SHADOW_TOKENS = ['--shadow-soft', '--shadow-pop', '--shadow-paper']

// vitest 默认不加载 CSS（css: false），?raw 拿不到内容，直读源文件做契约断言
// （jsdom 下 import.meta.url 非 file 协议，用 cwd 定位；vitest 始终从仓库根启动）
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')

function overrideBlock(id: string): string | null {
  return css.match(new RegExp(`:root\\[data-theme='${id}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? null
}

function themeBlock(): string {
  return css.match(/@theme \{[\s\S]*?\n\}/)![0]
}

describe('皮肤 token 覆盖块（skin-switching §③ 全表契约）', () => {
  const overrideIds = THEMES.filter((id) => id !== DEFAULT_THEME)

  it('除 paper（:root 默认）外八款皮肤各有覆盖块', () => {
    expect(overrideBlock('paper')).toBeNull()
    expect(overrideIds).toHaveLength(THEMES.length - 1)
  })

  it.each(overrideIds)('%s 覆盖块重定义全部 34 个颜色 token 与三组阴影', (id) => {
    const body = overrideBlock(id)
    expect(body, `缺少 :root[data-theme='${id}'] 覆盖块`).not.toBeNull()
    for (const token of COLOR_TOKENS) {
      expect(body!.includes(`${token}:`), `${id} 缺 ${token}`).toBe(true)
    }
    for (const shadow of SHADOW_TOKENS) {
      expect(body!.includes(`${shadow}:`), `${id} 缺 ${shadow}`).toBe(true)
    }
  })

  it('@theme 默认值域（= paper）含全部颜色 token', () => {
    const block = themeBlock()
    for (const token of COLOR_TOKENS) {
      expect(block.includes(`${token}:`), `@theme 缺 ${token}`).toBe(true)
    }
  })

  it('@theme 含 7 个皮肤化新增 ★ token', () => {
    const block = themeBlock()
    for (const token of [
      '--color-header',
      '--color-ink-hover',
      '--color-track',
      '--color-wash',
      '--color-wave-bg',
      '--color-wave-bar-a',
      '--color-wave-bar-b',
    ]) {
      expect(block).toContain(`${token}:`)
    }
  })

  it('派生色走 color-mix，历史写死色值已清除（审计表 ③-03）', () => {
    expect(css).toContain(
      '--shadow-btn-ink: 0 6px 14px -6px color-mix(in srgb, var(--color-ink) 55%, transparent)',
    )
    expect(css).toContain(
      'radial-gradient(1200px 800px at 18% -8%, color-mix(in srgb, var(--color-surface-2) 85%, transparent)',
    )
    // 播放键旧渐变亮端已 token 化
    expect(css).not.toContain('#d9a021')
    // 波形三色只允许出现在 @theme 默认值域（paper）一处，组件不得再写死
    for (const value of ['#f3efe2', '#b9ae8d', '#948a60']) {
      expect(css.split(value), value).toHaveLength(2)
    }
  })
})
