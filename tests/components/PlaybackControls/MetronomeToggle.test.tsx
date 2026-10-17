import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MetronomeToggle from '@/components/PlaybackControls/MetronomeToggle'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

function renderToggle(overrides: Partial<Parameters<typeof MetronomeToggle>[0]> = {}) {
  const props = {
    on: false,
    onToggle: vi.fn(),
    sound: 'classic' as const,
    onSoundChange: vi.fn(),
    strongVolume: 0.8,
    onStrongVolumeChange: vi.fn(),
    weakVolume: 0.5,
    onWeakVolumeChange: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<MetronomeToggle {...props} />)
  return props
}

describe('MetronomeToggle', () => {
  it('开关按钮反映 on 状态并回调', () => {
    const props = renderToggle()

    const toggle = screen.getByRole('button', { name: new RegExp(enUS.metronomeOff) })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(props.onToggle).toHaveBeenCalledTimes(1)
  })

  it('开启态按钮文案切换为 On', () => {
    renderToggle({ on: true })

    expect(screen.getByRole('button', { name: new RegExp(enUS.metronomeOn) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('齿轮展开设置面板：音色四选一 + 强/弱拍音量', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: enUS.metronomeSettings }))

    const panel = screen.getByRole('button', { name: enUS.metronomeSettings })
      .parentElement!.querySelector<HTMLElement>('div.absolute')!
    expect(panel).not.toBeNull()
    expect(within(panel).getByText(enUS.soundName)).toBeInTheDocument()
    // 音色四选一全部列出
    expect(
      within(panel).getAllByRole('button').map((b) => b.textContent),
    ).toEqual([
      enUS.metroSoundClassic,
      enUS.metroSoundDigital,
      enUS.metroSoundKick,
      enUS.metroSoundClick,
    ])
    expect(within(panel).getByRole('slider', { name: enUS.strongVolume })).toHaveValue('80')
    expect(within(panel).getByRole('slider', { name: enUS.weakVolume })).toHaveValue('50')
  })

  it('选择音色回调对应类型', () => {
    const props = renderToggle()
    fireEvent.click(screen.getByRole('button', { name: enUS.metronomeSettings }))

    const panel = screen.getByRole('button', { name: enUS.metronomeSettings })
      .parentElement!.querySelector<HTMLElement>('div.absolute')!
    fireEvent.click(within(panel).getByRole('button', { name: enUS.metroSoundKick }))

    expect(props.onSoundChange).toHaveBeenCalledWith('kick')
  })

  it('拖动音量滑杆回调 0–1 数值', () => {
    const props = renderToggle()
    fireEvent.click(screen.getByRole('button', { name: enUS.metronomeSettings }))

    const strong = screen.getByRole('slider', { name: enUS.strongVolume })
    fireEvent.change(strong, { target: { value: '30' } })
    expect(props.onStrongVolumeChange).toHaveBeenCalledWith(0.3)
  })

  it('Esc 关闭设置面板', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: enUS.metronomeSettings }))

    fireEvent.keyDown(window, { key: 'Escape' })

    // 面板关闭后音量滑杆不再在文档中
    expect(screen.queryByRole('slider', { name: enUS.strongVolume })).not.toBeInTheDocument()
  })

  it('点击外部关闭设置面板', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: enUS.metronomeSettings }))

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('slider', { name: enUS.strongVolume })).not.toBeInTheDocument()
  })
})
