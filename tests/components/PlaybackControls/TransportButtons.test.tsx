import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransportButtons from '@/components/PlaybackControls/TransportButtons'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

describe('TransportButtons', () => {
  it('停止态：主按钮显示播放、副按钮常驻停止', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    renderWithProviders(<TransportButtons playing={false} onPlayToggle={onPlayToggle} onStop={onStop} />)

    const play = screen.getByRole('button', { name: enUS.play })
    expect(play).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: enUS.stop })).toBeInTheDocument()

    fireEvent.click(play)
    expect(onPlayToggle).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('播放态：主按钮语义转为停止', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    renderWithProviders(<TransportButtons playing onPlayToggle={onPlayToggle} onStop={onStop} />)

    const stopButtons = screen.getAllByRole('button', { name: enUS.stop })
    // 主按钮（播放中语义转为停止）+ 副按钮常驻停止
    expect(stopButtons).toHaveLength(2)
    expect(stopButtons[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('副按钮点击回调 onStop', () => {
    const onStop = vi.fn()
    renderWithProviders(<TransportButtons playing={false} onPlayToggle={() => {}} onStop={onStop} />)

    fireEvent.click(screen.getByRole('button', { name: enUS.stop }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
