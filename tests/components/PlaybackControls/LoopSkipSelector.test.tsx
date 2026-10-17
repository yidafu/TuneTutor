import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LoopSkipSelector from '@/components/PlaybackControls/LoopSkipSelector'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

describe('LoopSkipSelector', () => {
  it('渲染 1–8 拍按钮与关闭态文案', () => {
    renderWithProviders(<LoopSkipSelector value={0} onChange={() => {}} />)

    const group = screen.getByRole('group', { name: enUS.skipLabel })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(screen.getByText(enUS.skipOff)).toBeInTheDocument()
  })

  it('点击未选中的拍数设为新值', () => {
    const onChange = vi.fn()
    renderWithProviders(<LoopSkipSelector value={0} onChange={onChange} />)

    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: '3' }))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('点击当前值归零', () => {
    const onChange = vi.fn()
    renderWithProviders(<LoopSkipSelector value={4} onChange={onChange} />)

    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: '4' }))

    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('选中态 aria-pressed 与说明文案随 value 变化', () => {
    const { rerender } = renderWithProviders(<LoopSkipSelector value={0} onChange={() => {}} />)

    rerender(<LoopSkipSelector value={2} onChange={() => {}} />)
    const pressed = within(screen.getByRole('group')).getByRole('button', { name: '2' })
    expect(pressed).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(enUS.skipPerLoop(2))).toBeInTheDocument()
    expect(screen.queryByText(enUS.skipOff)).not.toBeInTheDocument()
  })
})
