import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransportButtons from '@/components/PlaybackControls/TransportButtons'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

describe('TransportButtons', () => {
  it('停止态：单按钮显示播放，点击回调 onPlayToggle', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(
      <TransportButtons
        playing={false}
        onPlayToggle={onPlayToggle}
        samplesLoading={false}
        samplesFailed={false}
        onRetrySamples={vi.fn()}
      />,
    )

    const play = screen.getByRole('button', { name: enUS.play })
    expect(play).toHaveAttribute('aria-pressed', 'false')
    expect(play).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(play)
    expect(onPlayToggle).toHaveBeenCalledTimes(1)
  })

  it('播放态：同一按钮语义转为停止（单按钮切换，无常驻停止副键）', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(
      <TransportButtons
        playing
        onPlayToggle={onPlayToggle}
        samplesLoading={false}
        samplesFailed={false}
        onRetrySamples={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: enUS.stop })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: enUS.play })).not.toBeInTheDocument()
  })

  it('采样加载中：停止态禁用走带并挂 role=status 加载提示（点击不触发回调）', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(
      <TransportButtons
        playing={false}
        onPlayToggle={onPlayToggle}
        samplesLoading
        samplesFailed={false}
        onRetrySamples={vi.fn()}
      />,
    )

    const play = screen.getByRole('button', { name: enUS.play })
    expect(play).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(enUS.samplesLoading)

    fireEvent.click(play)
    expect(onPlayToggle).not.toHaveBeenCalled()
  })

  it('采样加载中但播放中：停止仍可用（走带可停），加载提示仍在', () => {
    const onPlayToggle = vi.fn()
    renderWithProviders(
      <TransportButtons
        playing
        onPlayToggle={onPlayToggle}
        samplesLoading
        samplesFailed={false}
        onRetrySamples={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: enUS.stop })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent(enUS.samplesLoading)
  })

  it('采样加载失败：失败提示 + 重试按钮回调 onRetrySamples，走带禁用', () => {
    const onPlayToggle = vi.fn()
    const onRetrySamples = vi.fn()
    renderWithProviders(
      <TransportButtons
        playing={false}
        onPlayToggle={onPlayToggle}
        samplesLoading={false}
        samplesFailed
        onRetrySamples={onRetrySamples}
      />,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(enUS.samplesFailed)
    expect(screen.getByRole('button', { name: enUS.play })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: enUS.retryLoad }))
    expect(onRetrySamples).toHaveBeenCalledTimes(1)
    expect(onPlayToggle).not.toHaveBeenCalled()
  })
})
