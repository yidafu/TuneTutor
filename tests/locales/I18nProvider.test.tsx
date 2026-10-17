import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import I18nProvider from '@/locales/I18nProvider'
import { LANGUAGE_STORAGE_KEY } from '@/locales/languages'
import { enUS } from '@/locales/en-US'
import { frFR } from '@/locales/fr-FR'
import { zhTW } from '@/locales/zh-TW'
import { useI18n } from '@/locales/useI18n'

function I18nProbe() {
  const { t, language, setLanguage } = useI18n()
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="nav">{t.navScore}</span>
      <button type="button" data-testid="switch" onClick={() => setLanguage('zh-TW')}>
        switch
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <I18nProvider>
      <I18nProbe />
    </I18nProvider>,
  )
}

afterEach(() => {
  // 清理测试中对 navigator.languages 的桩（浏览器语言回落用例）
  Reflect.deleteProperty(window.navigator, 'languages')
})

describe('I18nProvider / useI18n', () => {
  it('Provider 外使用 useI18n 抛错', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<I18nProbe />)).toThrow('useI18n must be used within an I18nProvider')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('无存储、无语言候选时默认 en-US', () => {
    renderProbe()
    expect(screen.getByTestId('language')).toHaveTextContent('en-US')
    expect(screen.getByTestId('nav')).toHaveTextContent(enUS.navScore)
  })

  it('localStorage 存储值优先生效', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr-FR')
    renderProbe()
    expect(screen.getByTestId('language')).toHaveTextContent('fr-FR')
    expect(screen.getByTestId('nav')).toHaveTextContent(frFR.navScore)
  })

  it('浏览器语言回落（zh-TW 候选）', () => {
    Object.defineProperty(window.navigator, 'languages', { value: ['zh-TW'], configurable: true })
    renderProbe()
    expect(screen.getByTestId('language')).toHaveTextContent('zh-TW')
  })

  it('setLanguage 更新显示并持久化到 localStorage', () => {
    renderProbe()
    fireEvent.click(screen.getByTestId('switch'))
    expect(screen.getByTestId('language')).toHaveTextContent('zh-TW')
    expect(screen.getByTestId('nav')).toHaveTextContent(zhTW.navScore)
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-TW')
  })

  it('无痕模式写入失败时切换仅会话内生效', () => {
    // vi.spyOn 拦截不到 jsdom Storage 方法，整体替换 window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
      clear: () => {},
    })
    renderProbe()
    fireEvent.click(screen.getByTestId('switch'))
    expect(screen.getByTestId('nav')).toHaveTextContent(zhTW.navScore)

    vi.unstubAllGlobals()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull()
  })
})
