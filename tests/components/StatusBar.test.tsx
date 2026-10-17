import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusBar from '@/components/StatusBar'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

function renderStatusBar(overrides: Partial<Parameters<typeof StatusBar>[0]> = {}) {
  const props = { playing: false, skipBeats: 0, instrument: 'piano' as const, tempo: 90, ...overrides }
  return renderWithProviders(<StatusBar {...props} />)
}

describe('StatusBar', () => {
  it('停止态 + 空拍关闭 + 乐器与 BPM 展示', () => {
    renderStatusBar()

    expect(screen.getByText(enUS.statusStopped)).toBeInTheDocument()
    expect(screen.getByText(enUS.skipOff)).toBeInTheDocument()
    expect(screen.getByText(enUS.selectionNone)).toBeInTheDocument()
    expect(screen.getByText('🎹 Piano')).toBeInTheDocument()
    expect(screen.getByText(`90 ${enUS.bpmUnit}`)).toBeInTheDocument()
  })

  it('播放态显示 Playing 指示', () => {
    renderStatusBar({ playing: true })

    expect(screen.getByText(enUS.statusPlaying)).toBeInTheDocument()
    expect(screen.queryByText(enUS.statusStopped)).not.toBeInTheDocument()
  })

  it('空拍开启时显示拍数简称', () => {
    renderStatusBar({ skipBeats: 4 })

    expect(screen.getByText(enUS.skipBeatsShort(4))).toBeInTheDocument()
    expect(screen.queryByText(enUS.skipOff)).not.toBeInTheDocument()
  })

  it('单拍空拍使用单数文案', () => {
    renderStatusBar({ skipBeats: 1 })

    expect(screen.getByText(enUS.skipBeatsShort(1))).toBeInTheDocument()
  })
})
