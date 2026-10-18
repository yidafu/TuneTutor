import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Header from '@/components/Header'
import { enUS } from '@/locales/en-US'
import { THEMES, THEME_STORAGE_KEY } from '@/themes'
import { renderWithProviders } from '../helpers/ui'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

/** 皮肤弹层（页头同时存在语言切换器，取 aria-label 区分） */
function openThemePopup() {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.theme.paper) }))
  return within(screen.getByRole('listbox', { name: enUS.theme.label }))
}

describe('ThemeSwitcher（skin-switching v1.1 §④）', () => {
  it('入口按钮显示当前皮肤名，弹层默认收起', () => {
    renderWithProviders(<Header />)

    const trigger = screen.getByRole('button', { name: new RegExp(enUS.theme.paper) })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox', { name: enUS.theme.label })).not.toBeInTheDocument()
  })

  it('弹层分经典/古风两组共 9 款，行含主题字形、三色预览与英文副标，选中项 ✓', () => {
    renderWithProviders(<Header />)
    const listbox = openThemePopup()

    expect(screen.getByText(enUS.theme.label)).toBeInTheDocument()
    expect(screen.getByText(enUS.theme.appliedHint)).toBeInTheDocument()
    expect(screen.getByText(enUS.theme.group.classic)).toBeInTheDocument()
    expect(screen.getByText(enUS.theme.group.antique)).toBeInTheDocument()

    const options = listbox.getAllByRole('option')
    expect(options).toHaveLength(THEMES.length)
    expect(listbox.getByRole('option', { name: new RegExp(enUS.theme.paper) })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // 英文副标不随语言翻译（对齐设计稿弹层 <em>Paper Ink</em>）
    expect(listbox.getByText('Black Lacquer', { selector: 'em' })).toBeInTheDocument()
    for (const option of options) {
      // 行首主题 identity 字形（ThemeGlyph）
      expect(option.querySelector('svg')).not.toBeNull()
      // 三色圆点预览（画布/语义/墨）
      expect(option.querySelectorAll('i')).toHaveLength(3)
    }
    // 行序：字形图标 → 名称 → 配色圆点（配色移到名称后）
    const first = options[0]
    expect(
      first.querySelector('svg')!.compareDocumentPosition(first.querySelector('i')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('点选即时换肤：写 dataset.theme + 持久化，弹层收起且入口名更新', () => {
    renderWithProviders(<Header />)
    const listbox = openThemePopup()

    fireEvent.click(listbox.getByRole('option', { name: /Nocturne/ }))

    expect(document.documentElement.dataset.theme).toBe('nocturne')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('nocturne')
    expect(screen.queryByRole('listbox', { name: enUS.theme.label })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(enUS.theme.nocturne) })).toBeInTheDocument()
  })

  it('非法存储值回落 paper（T4），换肤后写回合法值', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    renderWithProviders(<Header />)
    const listbox = openThemePopup()

    fireEvent.click(listbox.getByRole('option', { name: /Walnut/ }))

    expect(document.documentElement.dataset.theme).toBe('walnut')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('walnut')
  })

  it('Esc 关闭弹层', () => {
    renderWithProviders(<Header />)
    openThemePopup()
    expect(screen.getByRole('listbox', { name: enUS.theme.label })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('listbox', { name: enUS.theme.label })).not.toBeInTheDocument()
    // 关闭不换肤
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('点击弹层外关闭（与语言切换器共用范式）', () => {
    renderWithProviders(<Header />)
    openThemePopup()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('listbox', { name: enUS.theme.label })).not.toBeInTheDocument()
  })

  it('再次点入口收起弹层', () => {
    renderWithProviders(<Header />)
    const trigger = screen.getByRole('button', { name: new RegExp(enUS.theme.paper) })
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox', { name: enUS.theme.label })).toBeInTheDocument()

    fireEvent.click(trigger)

    expect(screen.queryByRole('listbox', { name: enUS.theme.label })).not.toBeInTheDocument()
  })
})
