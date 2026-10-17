import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TempoSlider, { TEMPO_MAX, TEMPO_MIN } from '@/components/PlaybackControls/TempoSlider'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

describe('TempoSlider', () => {
  it('范围输入与 BPM 大字展示', () => {
    renderWithProviders(<TempoSlider value={120} onChange={() => {}} />)

    const slider = screen.getByRole('slider', { name: enUS.tempoLabel })
    expect(slider).toHaveAttribute('min', String(TEMPO_MIN))
    expect(slider).toHaveAttribute('max', String(TEMPO_MAX))
    expect(slider).toHaveAttribute('value', '120')
    expect(slider).toBeEnabled()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('拖动滑杆回调新数值', () => {
    const onChange = vi.fn()
    renderWithProviders(<TempoSlider value={120} onChange={onChange} />)

    fireEvent.change(screen.getByRole('slider'), { target: { value: '96' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(96)
  })

  it('disabled 时只读展示', () => {
    const onChange = vi.fn()
    renderWithProviders(<TempoSlider value={90} onChange={onChange} disabled />)

    const slider = screen.getByRole('slider')
    expect(slider).toBeDisabled()
    expect(screen.getByText('90')).toBeInTheDocument()
    // jsdom 会在 disabled 元素上照常派发 change（浏览器不会），故不断言「不回调」
  })
})
