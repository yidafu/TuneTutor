import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OriginalAudioPage from '@/pages/OriginalAudioPage'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

const STAGE_WIDTH = 1000

/** 载入演示音频并对波形舞台做几何桩（jsdom 的 getBoundingClientRect 全零） */
function loadAudioWithStage() {
  renderWithProviders(<OriginalAudioPage tempo={90} />)
  fireEvent.click(screen.getByText(enUS.audioDropMain).closest('button')!)
  const stage = screen.getByLabelText(enUS.waveHint)
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: STAGE_WIDTH,
    bottom: 150,
    width: STAGE_WIDTH,
    height: 150,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
  return stage
}

/** 在舞台上拖出 [from, to] 占比切片（fraction: 0–1） */
function dragSlice(stage: HTMLElement, from: number, to: number) {
  const x = (fraction: number) => STAGE_WIDTH * fraction
  fireEvent.pointerDown(stage, { pointerId: 1, clientX: x(from), clientY: 20 })
  fireEvent.pointerMove(stage, { pointerId: 1, clientX: x(to), clientY: 20 })
  fireEvent.pointerUp(stage, { pointerId: 1 })
}

describe('OriginalAudioPage', () => {
  it('无音频空态：渲染演示载入入口', () => {
    renderWithProviders(<OriginalAudioPage tempo={90} />)

    expect(screen.getByText(enUS.audioStubHint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: enUS.removeAudio })).not.toBeInTheDocument()
  })

  it('点击载入演示音频：显示元信息、波形与控制区，速度滑杆只读', () => {
    renderWithProviders(<OriginalAudioPage tempo={90} />)

    fireEvent.click(screen.getByText(enUS.audioDropMain).closest('button')!)

    expect(screen.getByText(enUS.demoAudioName)).toBeInTheDocument()
    expect(screen.getByText('8.4 MB · 3:24 · 44.1 kHz')).toBeInTheDocument()
    const slider = screen.getByRole('slider', { name: enUS.tempoLabel })
    expect(slider).toBeDisabled()
    expect(slider).toHaveAttribute('value', '90')
  })

  it('拖拽创建切片后显示切片标注、循环区间与 LOOP chip', () => {
    const stage = loadAudioWithStage()
    dragSlice(stage, 0.25, 0.5)

    // 204s × 0.25–0.5 → 51s–102s
    expect(screen.getByText(enUS.loopChipLabel(51))).toBeInTheDocument()
    expect(screen.getByText(enUS.sliceTag('0:51', '1:42'))).toBeInTheDocument()
    expect(screen.getByText(enUS.loopRange('0:51', '1:42'))).toBeInTheDocument()
  })

  it('反向拖拽（从右往左）同样归一化为切片', () => {
    const stage = loadAudioWithStage()
    dragSlice(stage, 0.5, 0.25)

    expect(screen.getByText(enUS.loopRange('0:51', '1:42'))).toBeInTheDocument()
  })

  it('点按（未拖出宽度）不产生切片', () => {
    const stage = loadAudioWithStage()

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 20 })
    fireEvent.pointerUp(stage, { pointerId: 1 })

    expect(screen.queryByText(/LOOP/)).not.toBeInTheDocument()
  })

  it('双击切片移除', () => {
    const stage = loadAudioWithStage()
    dragSlice(stage, 0.25, 0.5)
    expect(screen.getByText(/LOOP/)).toBeInTheDocument()

    const sliceBox = screen.getByText(enUS.sliceTag('0:51', '1:42')).closest(
      '[data-slice-box]',
    )!
    fireEvent.doubleClick(sliceBox)

    expect(screen.queryByText(/LOOP/)).not.toBeInTheDocument()
  })

  it('移除音频回到空态', () => {
    renderWithProviders(<OriginalAudioPage tempo={90} />)
    fireEvent.click(screen.getByText(enUS.audioDropMain).closest('button')!)

    fireEvent.click(screen.getByRole('button', { name: enUS.removeAudio }))

    expect(screen.queryByText(enUS.demoAudioName)).not.toBeInTheDocument()
    expect(screen.getByText(enUS.audioStubHint)).toBeInTheDocument()
  })

  it('原曲页空拍gap选择持久化到 localStorage', () => {
    renderWithProviders(<OriginalAudioPage tempo={90} />)
    fireEvent.click(screen.getByText(enUS.audioDropMain).closest('button')!)

    fireEvent.click(
      within(screen.getByRole('group', { name: enUS.skipLabel })).getByRole('button', { name: '4' }),
    )

    expect(window.localStorage.getItem('note-slice-audio-gap')).toBe(JSON.stringify(4))
  })
})
