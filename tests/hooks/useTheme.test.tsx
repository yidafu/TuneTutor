import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/hooks/ThemeProvider'
import { useTheme } from '@/hooks/useTheme'
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/themes'

beforeEach(() => {
  window.localStorage.clear()
})

function renderUseTheme() {
  return renderHook(() => useTheme(), { wrapper: ThemeProvider })
}

describe('useTheme', () => {
  it('无存储值时默认 paper，且不回写 dataset（首帧归 index.html 内联脚本管）', () => {
    delete document.documentElement.dataset.theme

    const { result } = renderUseTheme()

    expect(result.current.theme).toBe(DEFAULT_THEME)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('读取合法存储值作为初始皮肤', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'celadon')

    const { result } = renderUseTheme()

    expect(result.current.theme).toBe('celadon')
  })

  it('非法存储值回落 paper（T4）', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized')

    const { result } = renderUseTheme()

    expect(result.current.theme).toBe('paper')
  })

  it('setTheme 即时写 dataset.theme 并持久化原始字符串（非 JSON）', () => {
    const { result } = renderUseTheme()

    act(() => result.current.setTheme('palace'))

    expect(result.current.theme).toBe('palace')
    expect(document.documentElement.dataset.theme).toBe('palace')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('palace')
  })

  it('localStorage 不可写时状态与 dataset 仍然生效', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota')
    })
    const { result } = renderUseTheme()

    act(() => result.current.setTheme('stage'))

    expect(result.current.theme).toBe('stage')
    expect(document.documentElement.dataset.theme).toBe('stage')
    vi.restoreAllMocks()
  })
})
