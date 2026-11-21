import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlaybackControls from '@/components/PlaybackControls/PlaybackControls'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

function renderControls() {
  const handlers = {
    onTempoChange: vi.fn(),
    onPlayToggle: vi.fn(),
    onRetrySamples: vi.fn(),
    onMetronomeToggle: vi.fn(),
    onMetroSoundChange: vi.fn(),
    onStrongVolumeChange: vi.fn(),
    onWeakVolumeChange: vi.fn(),
    onSkipBeatsChange: vi.fn(),
  }
  renderWithProviders(
    <PlaybackControls
      tempo={90}
      playing={false}
      samplesLoading={false}
      samplesFailed={false}
      metronomeOn={false}
      metroSound="classic"
      strongVolume={0.8}
      weakVolume={0.5}
      skipBeats={0}
      {...handlers}
    />,
  )
  return handlers
}

describe('PlaybackControls', () => {
  it('渲染四个区块：速度、走带、节拍器、空拍', () => {
    renderControls()

    expect(screen.getByRole('slider', { name: enUS.tempoLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: enUS.play })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(enUS.metronomeOff) })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: enUS.skipLabel })).toBeInTheDocument()
  })

  it('各控件回调透传到顶层 props', () => {
    const handlers = renderControls()

    fireEvent.change(screen.getByRole('slider', { name: enUS.tempoLabel }), { target: { value: '72' } })
    fireEvent.click(screen.getByRole('button', { name: enUS.play }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.metronomeOff) }))
    fireEvent.click(within(screen.getByRole('group', { name: enUS.skipLabel })).getByRole('button', { name: '5' }))

    expect(handlers.onTempoChange).toHaveBeenCalledWith(72)
    expect(handlers.onPlayToggle).toHaveBeenCalledTimes(1)
    expect(handlers.onMetronomeToggle).toHaveBeenCalledTimes(1)
    expect(handlers.onSkipBeatsChange).toHaveBeenCalledWith(5)
  })
})
