import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadInstrument } from '@/audio/InstrumentLoader'
import { PlaybackEngine } from '@/audio/PlaybackEngine'
import type { PlaybackIterationEvent, PlaybackState } from '@/audio/PlaybackEngine'
import type { MetronomeSettings } from '@/audio/PlaybackEngine'
import { deriveLoopRange, usePlayback, type UsePlaybackOptions } from '@/hooks/usePlayback'
import type { InstrumentType } from '@/types/audio'
import type { PlaybackEntry } from '@/types/playback'
import type { ScoreSelection } from '@/utils/notation/selection'
import { FakeDraw, FakeMetronomeVoice, FakeSampler, FakeTimingSource, ManualTimers } from '../helpers/playbackFake'

// loadInstrument（Tone 边界）以替身注入：具体返回在各测试内配置
vi.mock('@/audio/InstrumentLoader', () => ({
  createScorePlaybackEngine: vi.fn(),
  loadInstrument: vi.fn(),
}))

function melody(specs: Array<[startRv: number, durationRv?: number]>): PlaybackEntry[] {
  return specs.map(([startRv, durationRv], index) => ({
    startRv,
    durationRv: durationRv ?? 0.25,
    measureIndex: 0,
    noteIndex: index,
    noteName: `n${index}`,
  }))
}

function phraseSelection(startIndex: number, endIndex: number): ScoreSelection {
  return {
    kind: 'phrase',
    startIndex,
    endIndex,
    startMeasureIndex: 0,
    endMeasureIndex: 0,
    startEndpoint: 'slot',
    endEndpoint: 'slot',
  }
}

const DEFAULT_METRONOME: MetronomeSettings = {
  enabled: false,
  sound: 'classic',
  strongVolume: 0.8,
  weakVolume: 0.5,
  beatsPerMeasure: 4,
  beatValue: 4,
}

interface Rig {
  timing: FakeTimingSource
  sampler: FakeSampler
  draw: FakeDraw
  timers: ManualTimers
  metronomeVoices: FakeMetronomeVoice[]
  iterations: PlaybackIterationEvent[]
  states: PlaybackState[]
  result: { current: ReturnType<typeof usePlayback> }
  rerenderProps: (patch: Partial<UsePlaybackOptions>) => void
  unmount: () => void
}

function renderUsePlayback(initial: Partial<UsePlaybackOptions> = {}): Rig {
  const timing = new FakeTimingSource(60)
  const sampler = new FakeSampler()
  const draw = new FakeDraw()
  const timers = new ManualTimers()
  const metronomeVoices: FakeMetronomeVoice[] = []
  const iterations: PlaybackIterationEvent[] = []
  const states: PlaybackState[] = []
  const createEngine = vi.fn(async (bpm: number): Promise<PlaybackEngine> => {
    const engine = new PlaybackEngine({
      bpm,
      timingSource: timing,
      sampler,
      drawScheduler: draw,
      timers,
      metronomeFactory: (sound) => {
        const voice = new FakeMetronomeVoice(sound)
        metronomeVoices.push(voice)
        return voice
      },
    })
    engine.onIteration((event) => iterations.push(event))
    engine.onStateChange((state) => states.push(state))
    return engine
  })
  const props: UsePlaybackOptions = {
    tempo: 60,
    instrument: 'piano',
    metronome: DEFAULT_METRONOME,
    entries: [],
    selection: null,
    skipBeats: 0,
    createEngine,
    ...initial,
  }
  const utils = renderHook((next: UsePlaybackOptions) => usePlayback(next), { initialProps: props })
  let latest = props
  return {
    timing,
    sampler,
    draw,
    timers,
    metronomeVoices,
    iterations,
    states,
    result: utils.result,
    rerenderProps: (patch) => {
      latest = { ...latest, ...patch }
      utils.rerender(latest)
    },
    unmount: utils.unmount,
  }
}

/** play + 首 tick + Draw 冲刷（异步 play 完成后进入调度循环） */
async function playRig(rig: Rig): Promise<void> {
  await act(async () => {
    await rig.result.current.play()
  })
  act(() => {
    const delay = rig.timers.nextDelayMs()
    if (delay !== undefined) {
      rig.timing.advanceMs(delay)
      rig.timers.runNext()
      rig.draw.flush()
    }
  })
}

function runMs(rig: Rig, totalMs: number): void {
  let remaining = totalMs
  act(() => {
    while (remaining > 0 && rig.timers.pendingCount > 0) {
      const delay = Math.min(remaining, rig.timers.nextDelayMs() ?? 0)
      rig.timing.advanceMs(delay)
      rig.timers.runNext()
      rig.draw.flush()
      remaining -= delay
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // 挂载即触发乐器加载 effect：默认实现回填可用的替身音色
  vi.mocked(loadInstrument).mockImplementation(async (type: InstrumentType) => ({
    type,
    sampler: new FakeSampler(),
    ready: Promise.resolve(),
    isReady: () => true,
    hasError: () => false,
    dispose: () => {},
  }))
})

describe('deriveLoopRange（范围优先级唯一入口，docs/audio.md §3.4）', () => {
  const entries = melody([[0], [0.25], [0.5]])

  it('有选择：交由 computeLoopRange 推导（含 skipBeats）', () => {
    expect(deriveLoopRange(phraseSelection(0, 1), entries, 2)).toEqual({
      startRv: 0,
      endRv: 0.5,
      skipBeats: 2,
    })
  })

  it('无选择：空拍 > 0 循环全曲，否则 null（顺序播放）', () => {
    expect(deriveLoopRange(null, entries, 3)).toEqual({ startRv: 0, endRv: 0.75, skipBeats: 3 })
    expect(deriveLoopRange(null, entries, 0)).toBeNull()
    expect(deriveLoopRange(null, [], 3)).toBeNull()
  })
})

describe('usePlayback（引擎生命周期与接线，docs/audio.md §3.2/§3.8）', () => {
  it('引擎就绪后按接线序列挂载播放数据；换谱重挂', async () => {
    const rig = renderUsePlayback({ entries: melody([[0], [0.25]]) })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    expect(rig.result.current.engine).not.toBeNull()
    expect(rig.result.current.engine!.getPlaybackRange()).toEqual({ startRv: 0, endRv: 0.5 })
    // 换谱：新 entries 数组 → stop → load → setLoop → reset
    rig.rerenderProps({ entries: melody([[0], [0.25], [0.5], [0.75]]) })
    expect(rig.result.current.engine!.getPlaybackRange()).toEqual({ startRv: 0, endRv: 1 })
  })

  it('选择 → 循环区间；播放中改选择只写循环状态不停止（§3.4/selection.md §4.5）', async () => {
    const rig = renderUsePlayback({
      entries: melody([[0], [0.25], [0.5], [0.75]]),
      skipBeats: 1,
    })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    rig.rerenderProps({ selection: phraseSelection(1, 2) })
    expect(rig.result.current.engine!.getPlaybackRange()).toEqual({ startRv: 0.25, endRv: 0.75 })
    await playRig(rig)
    expect(rig.result.current.playing).toBe(true)
    rig.rerenderProps({ selection: phraseSelection(0, 3) })
    expect(rig.result.current.engine!.getPlaybackRange()).toEqual({ startRv: 0, endRv: 1 })
    expect(rig.result.current.playing).toBe(true) // 不重定位进行中的迭代
  })

  it('无选择 + 空拍 > 0：循环全曲不自动停；空拍 0：顺序播放至自动停止', async () => {
    const rig = renderUsePlayback({ entries: melody([[0], [0.25]]), skipBeats: 2 })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    await playRig(rig)
    runMs(rig, 8000) // 周期 = 2s 段 + 2s 空拍 → 8s 内两次回跳
    expect(rig.result.current.playing).toBe(true)
    expect(rig.iterations.filter((event) => event.resetOccurred).length).toBeGreaterThanOrEqual(2)

    const sequential = renderUsePlayback({ entries: melody([[0], [0.25]]) })
    await waitFor(() => expect(sequential.result.current.ready).toBe(true))
    await playRig(sequential)
    runMs(sequential, 5000)
    expect(sequential.result.current.playing).toBe(false)
    expect(sequential.states).toContain('STOPPED')
  })

  it('tempo 变更即时传播（决策 A2）', async () => {
    const rig = renderUsePlayback({ tempo: 60 })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    rig.rerenderProps({ tempo: 120 })
    expect(rig.timing.bpm).toBe(120)
  })

  it('节拍器设置传播；卸载 dispose 释放声部（§3.7/§2.3）', async () => {
    const rig = renderUsePlayback()
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    rig.rerenderProps({
      metronome: { ...DEFAULT_METRONOME, enabled: true, sound: 'kick' },
    })
    expect(rig.metronomeVoices).toHaveLength(1)
    expect(rig.metronomeVoices[0]!.sound).toBe('kick')
    rig.unmount()
    expect(rig.metronomeVoices[0]!.disposed).toBe(true)
  })

  it('乐器切换经 loadInstrument → setSampler：后续发声走新采样器（§3.6）', async () => {
    const rig = renderUsePlayback({ entries: melody([[0], [0.25], [0.5], [0.75]]) })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    const replacement = new FakeSampler()
    vi.mocked(loadInstrument).mockImplementation(async (type: InstrumentType) => ({
      type,
      sampler: replacement,
      ready: Promise.resolve(),
      isReady: () => true,
      hasError: () => false,
      dispose: () => {},
    }))
    rig.rerenderProps({ instrument: 'flute' })
    await waitFor(() => expect(vi.mocked(loadInstrument)).toHaveBeenCalledWith('flute'))
    await act(async () => {}) // setSampler 微任务落地
    await playRig(rig)
    expect(replacement.notes.length).toBeGreaterThan(0) // 发声走了新采样器
  })

  it('播放/停止/进度：playing 随状态事件翻转，进度相对区间归一', async () => {
    const rig = renderUsePlayback({ entries: melody([[0], [0.25], [0.5], [0.75]]) })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    expect(rig.result.current.playing).toBe(false)
    expect(rig.result.current.progress).toBe(0)
    await playRig(rig)
    expect(rig.result.current.playing).toBe(true)
    runMs(rig, 2000) // 区间中段（@60 = 2s 到 0.5 rv）
    await waitFor(() => expect(rig.result.current.progress).toBeGreaterThan(0))
    act(() => {
      rig.result.current.stop()
    })
    expect(rig.result.current.playing).toBe(false)
    expect(rig.result.current.progress).toBe(0)
  })
})

describe('usePlayback（采样加载窗口：samplesLoading/samplesFailed/retrySamples）', () => {
  /** 手工延迟的引擎工厂：resolve/reject 由测试控制（替身装配同主 describe） */
  function buildDeferredFactory(): {
    createEngine: (bpm: number) => Promise<PlaybackEngine>
    resolve: () => void
    reject: (reason?: unknown) => void
  } {
    const timing = new FakeTimingSource(60)
    const sampler = new FakeSampler()
    const draw = new FakeDraw()
    const timers = new ManualTimers()
    let resolveFactory: (() => void) | null = null
    let rejectFactory: ((reason?: unknown) => void) | null = null
    const createEngine = vi.fn((bpm: number): Promise<PlaybackEngine> => {
      return new Promise<PlaybackEngine>((resolve, reject) => {
        resolveFactory = () =>
          resolve(
            new PlaybackEngine({
              bpm,
              timingSource: timing,
              sampler,
              drawScheduler: draw,
              timers,
              metronomeFactory: (sound) => new FakeMetronomeVoice(sound),
            }),
          )
        rejectFactory = reject
      })
    })
    return {
      createEngine,
      resolve: () => resolveFactory?.(),
      reject: (reason?: unknown) => rejectFactory?.(reason),
    }
  }

  it('引擎工厂挂起（钢琴预载窗口）：samplesLoading=true；落地且采样就绪后转 false', async () => {
    const deferred = buildDeferredFactory()
    const rig = renderUsePlayback({ createEngine: deferred.createEngine })
    expect(rig.result.current.samplesLoading).toBe(true)
    expect(rig.result.current.ready).toBe(false)
    await act(async () => {
      deferred.resolve()
    })
    await waitFor(() => expect(rig.result.current.samplesLoading).toBe(false))
    expect(rig.result.current.ready).toBe(true)
    expect(rig.result.current.samplesFailed).toBe(false)
  })

  it('引擎创建失败（钢琴采样 reject）：samplesFailed=true；retrySamples 重跑工厂', async () => {
    const deferred = buildDeferredFactory()
    const rig = renderUsePlayback({ createEngine: deferred.createEngine })
    await act(async () => {
      deferred.reject(new Error('piano samples failed'))
    })
    await waitFor(() => expect(rig.result.current.samplesFailed).toBe(true))
    expect(rig.result.current.ready).toBe(false)

    act(() => {
      rig.result.current.retrySamples()
    })
    expect(deferred.createEngine).toHaveBeenCalledTimes(2)
    await act(async () => {
      deferred.resolve()
    })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    expect(rig.result.current.samplesFailed).toBe(false)
    expect(rig.result.current.samplesLoading).toBe(false)
  })

  it('乐器切换采样未就绪：samplesLoading=true 且 play() 守住不发车；就绪后恢复', async () => {
    const rig = renderUsePlayback({ entries: melody([[0], [0.25], [0.5], [0.75]]) })
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    let resolveReady!: () => void
    vi.mocked(loadInstrument).mockImplementation(async (type: InstrumentType) => ({
      type,
      sampler: new FakeSampler(),
      ready: new Promise<void>((resolve) => {
        resolveReady = resolve
      }),
      isReady: () => false,
      hasError: () => false,
      dispose: () => {},
    }))
    rig.rerenderProps({ instrument: 'flute' })
    await waitFor(() => expect(rig.result.current.samplesLoading).toBe(true))
    expect(rig.result.current.samplesFailed).toBe(false)

    act(() => {
      rig.result.current.play()
    })
    expect(rig.result.current.playing).toBe(false) // 未就绪不发车（与禁用按钮同源守卫）

    act(() => {
      resolveReady()
    })
    await waitFor(() => expect(rig.result.current.samplesLoading).toBe(false))
    await playRig(rig)
    expect(rig.result.current.playing).toBe(true)
  })

  it('音色采样加载失败：samplesFailed=true；retrySamples 重新加载音色并恢复', async () => {
    const rig = renderUsePlayback()
    await waitFor(() => expect(rig.result.current.ready).toBe(true))
    let rejectReady!: (reason?: unknown) => void
    let fluteCalls = 0
    const replacement = new FakeSampler()
    vi.mocked(loadInstrument).mockImplementation(async (type: InstrumentType) => {
      if (type !== 'flute') {
        return {
          type,
          sampler: new FakeSampler(),
          ready: Promise.resolve(),
          isReady: () => true,
          hasError: () => false,
          dispose: () => {},
        }
      }
      fluteCalls += 1
      if (fluteCalls === 1) {
        return {
          type,
          sampler: new FakeSampler(),
          ready: new Promise<void>((_resolve, reject) => {
            rejectReady = reject
          }),
          isReady: () => false,
          hasError: () => false,
          dispose: () => {},
        }
      }
      return {
        type,
        sampler: replacement,
        ready: Promise.resolve(),
        isReady: () => true,
        hasError: () => false,
        dispose: () => {},
      }
    })
    rig.rerenderProps({ instrument: 'flute' })
    await act(async () => {
      rejectReady(new Error('network'))
    })
    await waitFor(() => expect(rig.result.current.samplesFailed).toBe(true))

    act(() => {
      rig.result.current.retrySamples()
    })
    await waitFor(() => expect(rig.result.current.samplesFailed).toBe(false))
    await waitFor(() => expect(rig.result.current.samplesLoading).toBe(false))
    expect(fluteCalls).toBeGreaterThanOrEqual(2) // 重试确实重新加载了音色
  })
})
