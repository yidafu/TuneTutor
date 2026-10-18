import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from '@/components/Header'
import { enUS } from '@/locales/en-US'
import { zhCN } from '@/locales/zh-CN'
import { LANGUAGE_STORAGE_KEY } from '@/locales/languages'
import { renderWithProviders } from '../helpers/ui'

describe('Header', () => {
  it('渲染品牌、副标题与双页导航', () => {
    const { container } = renderWithProviders(<Header />)
    expect(screen.getByText('TuneTutor')).toBeInTheDocument()
    expect(screen.getByText(enUS.appSubtitle)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: enUS.navScore })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: enUS.navAudio })).toHaveAttribute('href', '/audio')

    // 品牌标志为「反复记号」SVG（粗线 + 细线 + 两点），非文字占位符
    const mark = container.querySelector('header div[aria-hidden] svg')
    expect(mark).toHaveAttribute('viewBox', '0 0 64 64')
    expect(mark?.querySelectorAll('rect')).toHaveLength(2)
    expect(mark?.querySelectorAll('circle')).toHaveLength(2)
  })

  it('语言菜单：展开、选中态、切换后持久化并即时生效', () => {
    renderWithProviders(<Header />)
    const trigger = screen.getByRole('button', { name: 'English' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(4)
    expect(within(listbox).getByRole('option', { name: 'English' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.click(within(listbox).getByRole('option', { name: '简体中文' }))

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN')
    expect(screen.getByRole('button', { name: '简体中文' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: zhCN.navScore })).toBeInTheDocument()
  })

  it('点击外部关闭语言菜单', () => {
    renderWithProviders(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
