import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { enUS } from '@/locales/en-US'
import { zhCN } from '@/locales/zh-CN'
import { renderWithProviders } from './helpers/ui'

// jsdom 无 SVG 布局，OSMD 用替身；原曲页 wavesurfer 同理
vi.mock('@/utils/notation/OsmdRender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/notation/OsmdRender')>()
  const { FakeOsmdRender } = await import('./helpers/osmdFake')
  return { ...actual, OsmdRender: FakeOsmdRender }
})
vi.mock('wavesurfer.js', async () => {
  const { FakeWaveSurfer } = await import('./helpers/wavesurferFake')
  return { default: { create: FakeWaveSurfer.create } }
})
vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', async () => {
  const { FakeRegionsPlugin } = await import('./helpers/wavesurferFake')
  return { default: { create: FakeRegionsPlugin.create } }
})
vi.mock('wavesurfer.js/dist/plugins/zoom.esm.js', async () => {
  const { FakeZoomPlugin } = await import('./helpers/wavesurferFake')
  return { default: { create: FakeZoomPlugin.create } }
})
// 乐谱页播放引擎以替身注入（引擎行为在 usePlayback/PlaybackEngine 测试覆盖）：
// 默认工厂会引入 Tone + 采样包，jsdom 无 AudioContext 不能真实构造
vi.mock('@/hooks/usePlayback', async () => {
  const { useCallback, useState } = await import('react')
  return {
    usePlayback: () => {
      const [playing, setPlaying] = useState(false)
      const toggle = useCallback((): void => {
        setPlaying((value) => !value)
      }, [])
      const stop = useCallback((): void => {
        setPlaying(false)
      }, [])
      return { ready: true, playing, progress: 0, play: toggle, stop, toggle, engine: null }
    },
    parseTimeSignature: (timeSignature: string) => {
      const [beats, beatType] = timeSignature.split('/')
      const numerator = Number.parseInt(beats ?? '', 10)
      const denominator = Number.parseInt(beatType ?? '', 10)
      return {
        beatsPerMeasure: Number.isFinite(numerator) && numerator > 0 ? numerator : 4,
        beatValue: Number.isFinite(denominator) && denominator > 0 ? denominator : 4,
      }
    },
  }
})

describe('App 路由壳', () => {
  it('默认路由渲染乐谱页', () => {
    renderWithProviders(<App />, { route: '/' })

    expect(screen.getByText(enUS.libraryTitle)).toBeInTheDocument()
    expect(screen.queryByText(enUS.audioDropMain)).not.toBeInTheDocument()
  })

  it('/audio 渲染原曲页（空态导入入口）', () => {
    renderWithProviders(<App />, { route: '/audio' })

    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    expect(screen.queryByText(enUS.libraryTitle)).not.toBeInTheDocument()
  })

  it('导航在两页间切换', () => {
    renderWithProviders(<App />, { route: '/' })

    fireEvent.click(screen.getByRole('link', { name: enUS.navAudio }))
    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: enUS.navScore }))
    expect(screen.getByText(enUS.libraryTitle)).toBeInTheDocument()
  })

  it('tempo 两页共享：乐谱页修改后切回原曲页仍持有', () => {
    renderWithProviders(<App />, { route: '/' })

    // 在乐谱页调高速度
    fireEvent.change(screen.getAllByRole('slider', { name: enUS.tempoLabel })[0], {
      target: { value: '150' },
    })

    // 切到原曲页：空态无滑杆（音频未载入）；切回乐谱页滑杆仍为 150（App 持有）
    fireEvent.click(screen.getByRole('link', { name: enUS.navAudio }))
    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: enUS.navScore }))
    const slider = screen.getByRole('slider', { name: enUS.tempoLabel })
    expect(slider).toHaveAttribute('value', '150')
  })

  it('语言切换持久化（Header 集成）', () => {
    renderWithProviders(<App />, { route: '/' })

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    fireEvent.click(screen.getByRole('option', { name: '简体中文' }))

    expect(screen.getByRole('link', { name: zhCN.navScore })).toBeInTheDocument()
  })
})
