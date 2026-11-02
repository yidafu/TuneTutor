import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransportButtons from '@/components/PlaybackControls/TransportButtons'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

describe('TransportButtons', () => {
  it('停止态：单按钮显示播放，点击回调 onPlayToggle', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(<TransportButtons playing={false} onPlayToggle={onPlayToggle} />)

    const play = screen.getByRole('button', { name: enUS.play })
    expect(play).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(play)
    expect(onPlayToggle).toHaveBeenCalledTimes(1)
  })

  it('播放态：同一按钮语义转为停止（单按钮切换，无常驻停止副键）', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(<TransportButtons playing onPlayToggle={onPlayToggle} />)

    expect(screen.getByRole('button', { name: enUS.stop })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: enUS.play })).not.toBeInTheDocument()
  })
})
