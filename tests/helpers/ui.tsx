import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import I18nProvider from '@/locales/I18nProvider'

interface RenderWithProvidersOptions extends RenderOptions {
  /** MemoryRouter 初始路由（App/页面/Header 需要；纯组件忽略） */
  route?: string
}

/** 包裹 MemoryRouter + I18nProvider 的渲染（默认 en-US：localStorage 已在 setup 清空） */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <I18nProvider>{children}</I18nProvider>
      </MemoryRouter>
    )
  }
  return render(ui, { wrapper: Wrapper, ...options })
}
