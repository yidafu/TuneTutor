import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { enUS } from '@/locales/en-US'
import { zhCN } from '@/locales/zh-CN'
import { renderWithProviders } from './helpers/ui'

describe('App 路由壳', () => {
  it('默认路由渲染乐谱页', () => {
    renderWithProviders(<App />, { route: '/' })

    expect(screen.getByText(enUS.libraryTitle)).toBeInTheDocument()
    expect(screen.queryByText(enUS.audioStubHint)).not.toBeInTheDocument()
  })

  it('/audio 渲染原曲页', () => {
    renderWithProviders(<App />, { route: '/audio' })

    expect(screen.getByText(enUS.audioStubHint)).toBeInTheDocument()
    expect(screen.queryByText(enUS.libraryTitle)).not.toBeInTheDocument()
  })

  it('导航在两页间切换', () => {
    renderWithProviders(<App />, { route: '/' })

    fireEvent.click(screen.getByRole('link', { name: enUS.navAudio }))
    expect(screen.getByText(enUS.audioStubHint)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: enUS.navScore }))
    expect(screen.getByText(enUS.libraryTitle)).toBeInTheDocument()
  })

  it('tempo 两页共享：乐谱页修改后原曲页保持（文案为只读展示佐证）', () => {
    renderWithProviders(<App />, { route: '/' })

    // 在乐谱页调高速度
    fireEvent.change(screen.getAllByRole('slider', { name: enUS.tempoLabel })[0], {
      target: { value: '150' },
    })

    // 切到原曲页，载入演示音频后只读滑杆仍显示 150
    fireEvent.click(screen.getByRole('link', { name: enUS.navAudio }))
    fireEvent.click(screen.getByText(enUS.audioDropMain).closest('button')!)
    const slider = screen.getByRole('slider', { name: enUS.tempoLabel })
    expect(slider).toBeDisabled()
    expect(slider).toHaveAttribute('value', '150')
  })

  it('语言切换持久化（Header 集成）', () => {
    renderWithProviders(<App />, { route: '/' })

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    fireEvent.click(screen.getByRole('option', { name: '简体中文' }))

    expect(screen.getByRole('link', { name: zhCN.navScore })).toBeInTheDocument()
  })
})
