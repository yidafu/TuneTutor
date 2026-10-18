import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ScorePage from '@/pages/ScorePage'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

function renderScorePage() {
  const onTempoChange = vi.fn()
  renderWithProviders(<ScorePage tempo={90} onTempoChange={onTempoChange} />)
  return onTempoChange
}

describe('ScorePage', () => {
  it('渲染乐谱页骨架：标题、加载按钮、乐谱卡、控制条、状态栏', () => {
    renderScorePage()

    expect(screen.getByText(enUS.libraryTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(enUS.loadScore) })).toBeInTheDocument()
    expect(screen.getByText(enUS.demoScoreTitle)).toBeInTheDocument()
    expect(screen.getByText(enUS.notationPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: enUS.tempoLabel })).toBeInTheDocument()
    expect(screen.getByText(enUS.statusStopped)).toBeInTheDocument()
  })

  it('加载按钮打开弹窗，Esc 关闭', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('播放快捷键：Space 切换播放，Esc 停止', () => {
    renderScorePage()

    fireEvent.keyDown(window, { code: 'Space' })
    expect(screen.getByText(enUS.statusPlaying)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText(enUS.statusStopped)).toBeInTheDocument()
  })

  it('弹窗打开时 Space 不再触发播放（快捷键让位）', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    fireEvent.keyDown(window, { code: 'Space' })

    expect(screen.queryByText(enUS.statusPlaying)).not.toBeInTheDocument()
  })

  it('速度滑杆回调透传给 onTempoChange（App 共享）', () => {
    const onTempoChange = renderScorePage()

    fireEvent.change(screen.getByRole('slider', { name: enUS.tempoLabel }), { target: { value: '110' } })

    expect(onTempoChange).toHaveBeenCalledWith(110)
  })

  it('空拍选择透传到状态栏', () => {
    renderScorePage()

    fireEvent.click(
      within(screen.getByRole('group', { name: enUS.skipLabel })).getByRole('button', { name: '2' }),
    )

    expect(screen.getByText(enUS.skipBeatsShort(2))).toBeInTheDocument()
  })

  it('乐器选择持久化到 localStorage', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.instrumentPiano) }))
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: new RegExp(enUS.instrumentGuitar),
      }),
    )

    expect(window.localStorage.getItem('note-slice-preferred-instrument')).toBe(
      JSON.stringify('guitar'),
    )
    // 乐器字形已 SVG 化（InstrumentGlyph）；触发按钮与状态栏都展示标签，按角色断言触发器
    expect(
      screen.getByRole('button', { name: new RegExp(enUS.instrumentGuitar) }),
    ).toBeInTheDocument()
  })
})
