import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { InstrumentGlyph, ThemeIcon } from '@/components/icons/ThemeIcon'
import { THEME_ICON_SETS, type IconGeometry, type ThemeIconName } from '@/components/icons/geometry'
import { THEME_ICON_STYLES } from '@/components/icons/styles'
import { ThemeProvider } from '@/hooks/ThemeProvider'
import { useTheme } from '@/hooks/useTheme'
import { THEMES, THEME_STORAGE_KEY, type ThemeId } from '@/themes'
import { INSTRUMENT_TYPES } from '@/types/audio'

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

function ThemeTargetButton({ target }: { target: ThemeId }) {
  const { setTheme } = useTheme()
  return (
    <button type="button" onClick={() => setTheme(target)}>
      switch
    </button>
  )
}

const ICON_NAMES: ThemeIconName[] = [
  'piano', 'sax', 'guitar', 'bass', 'violin', 'flute', 'trumpet',
  'play', 'stop', 'metro', 'loop', 'gear', 'folder', 'note', 'trash', 'phones', 'palette',
]

/** 递归提取几何 ReactNode 里所有图形的形位属性（d / rect / circle），校验与签名用 */
function collectShapes(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (Array.isArray(node)) {
    for (const child of node) collectShapes(child, out)
    return out
  }
  if (typeof node === 'string' || typeof node === 'number') return out
  const element = node as { type?: unknown; props?: Record<string, unknown> }
  const props = element.props
  if (props) {
    if (typeof props.d === 'string') {
      out.push(`path:${props.d}`)
    } else if (props.cx !== undefined) {
      out.push(`circle:${String(props.cx)},${String(props.cy)},r=${String(props.r)}`)
    } else if (props.x !== undefined && props.width !== undefined) {
      out.push(`rect:${String(props.x)},${String(props.y)},${String(props.width)}x${String(props.height)},rx=${String(props.rx ?? 0)}`)
    }
    if (props.children !== undefined) collectShapes(props.children as ReactNode, out)
  }
  return out
}

/** 专形序列化：几何字形（paths + accents + solid）的稳定签名，用于跨主题互异断言 */
function serializeGeometry({ paths, accents, solid }: IconGeometry): string {
  return JSON.stringify({
    p: collectShapes(paths),
    a: collectShapes(accents ?? null),
    s: solid ?? false,
  })
}

describe('ThemeIcon（每主题专形专绘一套图标）', () => {
  it('九款皮肤各注册一整套 17 枚图标（无遗漏、无多余）', () => {
    expect([...THEMES].sort()).toEqual(Object.keys(THEME_ICON_SETS).sort())
    for (const theme of THEMES) {
      const set = THEME_ICON_SETS[theme]
      expect(Object.keys(set).sort(), theme).toEqual([...ICON_NAMES].sort())
    }
  })

  it('走带键在每一套里都恒实心（SOLID_ICONS 规格）', () => {
    for (const theme of THEMES) {
      expect(THEME_ICON_SETS[theme].play.solid, `${theme}/play`).toBe(true)
      expect(THEME_ICON_SETS[theme].stop.solid, `${theme}/stop`).toBe(true)
    }
  })

  it('所有 path 的 d 属性语法合法（M 起笔、无非法指令、无 NaN）', () => {
    for (const theme of THEMES) {
      for (const name of ICON_NAMES) {
        const geometry = THEME_ICON_SETS[theme][name]
        const ds = [...collectShapes(geometry.paths), ...collectShapes(geometry.accents ?? null)]
          .filter((s) => s.startsWith('path:'))
          .map((s) => s.slice(5))
        for (const d of ds) {
          expect(d, `${theme}/${name}`).toMatch(/^[Mm]/)
          expect(d, `${theme}/${name}`).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]+$/)
          expect(d, `${theme}/${name}`).not.toContain('NaN')
        }
      }
    }
  })

  it('每枚图标在九款皮肤下字形互异（专形专绘，而非共用几何）', () => {
    for (const name of ICON_NAMES) {
      const signatures = THEMES.map((theme) => serializeGeometry(THEME_ICON_SETS[theme][name]))
      expect(new Set(signatures).size, `${name} 应有 9 套互异字形`).toBe(9)
    }
  })

  it('每款皮肤都定义了图标笔触', () => {
    expect(Object.keys(THEME_ICON_STYLES).sort()).toEqual([...THEMES].sort())
  })

  it('换肤同时切换笔触与字形：paper 中锋 → walnut 浑厚且附属件实心化', () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeTargetButton target="walnut" />
        <ThemeIcon name="metro" />
      </ThemeProvider>,
    )
    const icon = container.querySelector('svg')!

    // 默认 paper：线宽 1.75（v1.2 规格），摆锤描边（空心）
    expect(icon).toHaveAttribute('stroke-width', '1.75')
    expect(icon.querySelector('g[stroke="none"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(icon).toHaveAttribute('stroke-width', THEME_ICON_STYLES.walnut.strokeWidth.toString())
    expect(icon.querySelector('g[stroke="none"]')).not.toBeNull()
    // 字形也随肤切换：walnut 摆锤圆点比 paper 大（r 1.5 vs 1.15）
    expect(icon.querySelector('g[stroke="none"] circle')).toHaveAttribute('r', '1.5')
  })

  it('play/stop 恒实心（fill=currentColor），不随 accents 模式翻转', () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeIcon name="play" />
      </ThemeProvider>,
    )
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
  })

  it('palace 使用宫式方折笔触（square 端头 + miter 接合）', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'palace')
    const { container } = render(
      <ThemeProvider>
        <ThemeIcon name="play" />
      </ThemeProvider>,
    )
    const icon = container.querySelector('svg')!
    expect(icon).toHaveAttribute('stroke-width', THEME_ICON_STYLES.palace.strokeWidth.toString())
    expect(icon).toHaveAttribute('stroke-linecap', THEME_ICON_STYLES.palace.linecap)
    expect(icon).toHaveAttribute('stroke-linejoin', THEME_ICON_STYLES.palace.linejoin)
  })

  it('全部 17 枚图标 × 9 款皮肤均可渲染', () => {
    for (const theme of THEMES) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      for (const name of ICON_NAMES) {
        const { container, unmount } = render(
          <ThemeProvider>
            <ThemeIcon name={name} />
          </ThemeProvider>,
        )
        expect(container.querySelector('svg'), `${theme}/${name}`).not.toBeNull()
        unmount()
      }
    }
  })

  it('InstrumentGlyph：7 种乐器全部 SVG 化，无 emoji 字形残留', () => {
    for (const instrument of INSTRUMENT_TYPES) {
      const { container, unmount } = render(
        <ThemeProvider>
          <InstrumentGlyph instrument={instrument} />
        </ThemeProvider>,
      )
      expect(container.querySelector('svg'), instrument).not.toBeNull()
      expect(container.textContent).toBe('')
      unmount()
    }
  })
})
