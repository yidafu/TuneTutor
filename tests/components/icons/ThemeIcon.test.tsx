import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { InstrumentGlyph, ThemeIcon } from '@/components/icons/ThemeIcon'
import { ICON_GEOMETRY, type ThemeIconName } from '@/components/icons/geometry'
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

describe('ThemeIcon（每主题一套图标）', () => {
  it('几何库覆盖 17 枚定稿图标（v1.2 全量替换清单，emoji 无残留）', () => {
    const names = Object.keys(ICON_GEOMETRY) as ThemeIconName[]
    expect(names).toHaveLength(17)
    expect(new Set(names)).toEqual(
      new Set([
        'piano', 'sax', 'guitar', 'bass', 'violin', 'flute', 'trumpet',
        'play', 'stop', 'metro', 'loop', 'gear', 'folder', 'note', 'trash', 'phones', 'palette',
      ]),
    )
    // 走带键恒实心（SOLID_ICONS 规格）
    expect(ICON_GEOMETRY.play.solid).toBe(true)
    expect(ICON_GEOMETRY.stop.solid).toBe(true)
  })

  it('每款皮肤都定义了图标笔触', () => {
    expect(Object.keys(THEME_ICON_STYLES).sort()).toEqual([...THEMES].sort())
  })

  it('同一几何随换肤切换笔触：paper 中锋 → walnut 浑厚且附属件实心化', () => {
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
    const names = Object.keys(ICON_GEOMETRY) as ThemeIconName[]
    for (const theme of THEMES) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      for (const name of names) {
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
