import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeGlyph } from '@/components/icons/ThemeIcon'
import { THEME_GLYPHS } from '@/components/icons/themeGlyphs'
import { THEME_ICON_STYLES } from '@/components/icons/styles'
import { ThemeProvider } from '@/hooks/ThemeProvider'
import { THEMES, THEME_STORAGE_KEY } from '@/themes'

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeGlyph（弹层行首主题 identity 字形）', () => {
  it('字形库覆盖 9 款默认皮肤，一一对应', () => {
    expect(Object.keys(THEME_GLYPHS).sort()).toEqual([...THEMES].sort())
  })

  it('笔触固定取「本主题」的 THEME_ICON_STYLES，与当前皮肤无关', () => {
    // 当前皮肤 paper（默认），但 palace 字形按宫式方折笔触渲染
    const { container } = render(
      <ThemeProvider>
        <ThemeGlyph themeId="palace" />
      </ThemeProvider>,
    )
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('stroke-width', THEME_ICON_STYLES.palace.strokeWidth.toString())
    expect(svg).toHaveAttribute('stroke-linecap', THEME_ICON_STYLES.palace.linecap)
    expect(svg).toHaveAttribute('stroke-linejoin', THEME_ICON_STYLES.palace.linejoin)
    // palace 为 fill 型点缀：宫门实心色块
    expect(svg.querySelector('g[stroke="none"]')).not.toBeNull()
  })

  it('stroke 型主题（paper）整枚描线，无实心点缀层', () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeGlyph themeId="paper" />
      </ThemeProvider>,
    )
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1.75')
    expect(container.querySelector('g[stroke="none"]')).toBeNull()
  })

  it('9 枚字形 × 9 款当前皮肤均渲染出图形内容', () => {
    for (const current of THEMES) {
      window.localStorage.setItem(THEME_STORAGE_KEY, current)
      for (const id of THEMES) {
        const { container, unmount } = render(
          <ThemeProvider>
            <ThemeGlyph themeId={id} />
          </ThemeProvider>,
        )
        const svg = container.querySelector('svg')
        expect(svg, `${current}/${id}`).not.toBeNull()
        expect(svg!.innerHTML, `${current}/${id}`).not.toBe('')
        unmount()
      }
    }
  })
})
