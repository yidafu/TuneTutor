import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackEngine, NOTE_VELOCITY } from '@/audio/PlaybackEngine'
import type {
  MetronomeVoice,
  PlaybackIterationEvent,
  PlaybackState,
} from '@/audio/PlaybackEngine'
import type { LoopRange, PlaybackEntry } from '@/types/playback'
import type { MetronomeSoundType } from '@/types/audio'
import {
  FakeDraw,
  FakeMetronomeVoice,
  FakeSampler,
  FakeTimingSource,
  ManualTimers,
} from '../helpers/playbackFake'

// 测试替身（fake 时钟 + fake 采样器 + 手动定时器）抽至 tests/helpers/playbackFake.ts，
// 与 usePlayback 测试共用同一契约。

// ── 装配 ────────────────────────────────────────────────────────────────

interface RigOptions {
  bpm?: number
  loop?: LoopRange | null
  metronome?: { enabled?: boolean; beatsPerMeasure?: number }
}

interface Rig {
  engine: PlaybackEngine
  timing: FakeTimingSource
  sampler: FakeSampler
  draw: FakeDraw
  timers: ManualTimers
  metronomeVoices: FakeMetronomeVoice[]
  iterations: PlaybackIterationEvent[]
  states: PlaybackState[]
}

function createRig(entries: PlaybackEntry[], options: RigOptions = {}): Rig {
  const bpm = options.bpm ?? 60
  const timing = new FakeTimingSource(bpm)
  const sampler = new FakeSampler()
  const draw = new FakeDraw()
  const timers = new ManualTimers()
  const metronomeVoices: FakeMetronomeVoice[] = []
  const engine = new PlaybackEngine({
    bpm,
    timingSource: timing,
    sampler,
    drawScheduler: draw,
    timers,
    metronomeFactory: (sound: MetronomeSoundType): MetronomeVoice => {
      const voice = new FakeMetronomeVoice(sound)
      metronomeVoices.push(voice)
      return voice
    },
  })
  const iterations: PlaybackIterationEvent[] = []
  engine.onIteration((event) => iterations.push(event))
  const states: PlaybackState[] = []
  engine.onStateChange((state) => states.push(state))
  engine.load(entries)
  engine.setLoop(options.loop === undefined ? null : options.loop)
  if (options.metronome !== undefined) engine.setMetronome(options.metronome)
  return { engine, timing, sampler, draw, timers, metronomeVoices, iterations, states }
}

/** 顺序条目构建：每项 [startRv, durationRv]，noteIndex 连续、音名 n0/n1/…（断言可辨条目） */
function melody(specs: Array<[startRv: number, durationRv?: number]>): PlaybackEntry[] {
  return specs.map(([startRv, durationRv], index) => ({
    startRv,
    durationRv: durationRv ?? 0.25,
    measureIndex: 0,
    noteIndex: index,
    noteName: `n${index}`,
  }))
}

/** 时间推进一步：按引擎排定的下一定时器等待推进时钟，再触发它并冲刷 Draw 事件 */
function step(rig: Rig): void {
  const delay = rig.timers.nextDelayMs()
  if (delay === undefined) throw new Error('no pending timer')
  rig.timing.advanceMs(delay)
  rig.timers.runNext()
  rig.draw.flush()
}

function runMs(rig: Rig, totalMs: number): void {
  let remaining = totalMs
  while (remaining > 0 && rig.timers.pendingCount > 0) {
    const delay = Math.min(remaining, rig.timers.nextDelayMs() ?? 0)
    rig.timing.advanceMs(delay)
    rig.timers.runNext()
    rig.draw.flush()
    remaining -= delay
  }
}

/** play() + 首个 tick（setTimeout(0)）：引擎进入调度循环的第一步 */
async function playRig(rig: Rig): Promise<void> {
  await rig.engine.play()
  step(rig)
}

function sampledNames(rig: Rig): string[] {
  return rig.sampler.notes.map((note) => note.note)
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ── 调度（§3.1）────────────────────────────────────────────────────────

describe('PlaybackEngine look-ahead 调度', () => {
  it('首 tick 调度窗口内条目：采样精确 when、velocity 0.7、时长按 BPM 换算', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5]]))
    await playRig(rig)
    expect(rig.engine.getState()).toBe('PLAYING')
    expect(rig.states).toEqual(['PLAYING'])
    // @60BPM：窗口 100ms = 0.025 rv → 只调度 startRv 0
    expect(rig.sampler.notes).toEqual([
      { note: 'n0', duration: 1, when: 1000, velocity: NOTE_VELOCITY },
    ])
    // iteration 经 Draw 调度到同一 when（§3.1-⑥）
    expect(rig.draw.scheduledWhens).toEqual([1000])
    expect(rig.iterations).toHaveLength(1)
    expect(rig.iterations[0]!.resetOccurred).toBe(false)
    expect(rig.iterations[0]!.entry?.startRv).toBe(0)
  })

  it('窗口右界含端点容差 ±ε（§2.5）：恰在 100ms 边界的条目入窗，界外不入', async () => {
    const rig = createRig(melody([[0], [0.025], [0.026]]))
    await playRig(rig)
    // 0.025 rv @60 = 100ms：窗口 (0, 0.025] 含端点 → 入窗；0.026 出界
    expect(sampledNames(rig)).toEqual(['n0', 'n1'])
    const boundary = rig.sampler.notes[1]!
    expect(boundary.note).toBe('n1')
    expect(boundary.duration).toBe(1)
    expect(boundary.when).toBeCloseTo(1000.1, 6)
    expect(boundary.velocity).toBe(NOTE_VELOCITY)
    runMs(rig, 1000)
    expect(sampledNames(rig)).toEqual(['n0', 'n1', 'n2']) // 时钟推进后入窗，恰好一次
  })

  it('定位安全间隔（§2.3）：起点前 0.02 rv 内的条目立即补播，更早的不补播', async () => {
    const rig = createRig(melody([[0.45], [0.48], [0.49], [0.5], [0.6]]), {
      loop: { startRv: 0.5, endRv: 1, skipBeats: 0 },
    })
    await playRig(rig)
    // 0.48（恰在安全间隔端点）、0.49、0.5 立即补播；0.45（超间隔）永不入窗
    expect(sampledNames(rig)).toEqual(['n1', 'n2', 'n3'])
    expect(rig.sampler.notes[0]!.when).toBe(1000)
    runMs(rig, 2000)
    // 0.6 在窗内时以精确 when 调度（wait 0.1 rv @60 = 0.4s，音频钟秒域）
    const late = rig.sampler.notes[3]!
    expect(late.note).toBe('n4')
    expect(late.when).toBeCloseTo(1000.4, 6)
    expect(sampledNames(rig)).not.toContain('n0')
  })

  it('窗口右端钳到 loop.endRv：循环段外的音永不入窗（回跳不炸音，§3.4）', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5], [0.75]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 0 },
    })
    await playRig(rig)
    runMs(rig, 5000) // 足够跨越多次循环
    const names = sampledNames(rig)
    expect(names).not.toContain('n2')
    expect(names).not.toContain('n3')
    expect(names.filter((name) => name === 'n0').length).toBeGreaterThanOrEqual(2)
    expect(names.filter((name) => name === 'n1').length).toBeGreaterThanOrEqual(2)
    expect(rig.engine.getState()).toBe('PLAYING')
  })
})

// ── 循环状态机（§3.4）──────────────────────────────────────────────────

describe('PlaybackEngine 循环与空拍', () => {
  it('空拍回跳：setTimeout(beatsToSeconds) 现算、回跳重锚定、广播 resetOccurred', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 1 },
    })
    await playRig(rig)
    runMs(rig, 2000) // ts 到达 0.5 rv（2s）触发空拍等待
    expect(rig.timers.nextDelayMs()).toBe(1000) // 1 拍 @60BPM，round 整毫秒
    step(rig)
    // 回跳：时钟重锚定到循环起点；iteration 携带显式 resetOccurred（§3.8）
    expect(rig.engine.getCurrentTimestamp()).toBeCloseTo(0, 12)
    const wrap = rig.iterations.find((event) => event.resetOccurred)
    expect(wrap).toBeDefined()
    expect(wrap?.entry?.startRv).toBe(0)
    expect(rig.engine.getState()).toBe('PLAYING')
    // 回跳后重新调度段内条目
    runMs(rig, 1000)
    expect(sampledNames(rig).filter((name) => name === 'n0')).toHaveLength(2)
  })

  it('空拍秒数随播放中 setBpm 现算、不缓存（决策 A3）', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 2 },
    })
    await playRig(rig)
    runMs(rig, 2000)
    expect(rig.timers.nextDelayMs()).toBe(2000) // 2 拍 @60
    rig.engine.setBpm(120)
    step(rig) // 第一次空拍（已按旧速排定）结束，回跳
    runMs(rig, 1000) // @120：0.5 rv = 1s，再次触发回跳
    expect(rig.timers.nextDelayMs()).toBe(1000) // 2 拍 @120 —— 现算而非缓存
  })

  it('播放中改变 loop 边界：当前段播完回跳时按新边界执行（selection.md §4.5）', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5], [0.75]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 0 },
    })
    await playRig(rig)
    rig.engine.setLoop({ startRv: 0.25, endRv: 0.75, skipBeats: 0 })
    runMs(rig, 4000)
    const starts = rig.iterations.filter((event) => !event.resetOccurred).map((e) => e.entry?.startRv)
    // 边界写入后，回跳从新起点 0.25 重来
    expect(starts).toContain(0.25)
    expect(rig.engine.getState()).toBe('PLAYING')
  })
})

// ── 自动停止（§2.2-7 / §3.4）──────────────────────────────────────────

describe('PlaybackEngine 自动停止', () => {
  it('顺序播放至数据终点自动停止：等最后一音播完而非最后一个发音时刻', async () => {
    const rig = createRig(melody([[0], [0.25, 0.5]])) // 终点 = 0.75 rv = 3s @60
    await playRig(rig)
    runMs(rig, 2000)
    expect(rig.engine.getState()).toBe('PLAYING') // 末音仍在播
    runMs(rig, 1100)
    expect(rig.engine.getState()).toBe('STOPPED')
    expect(rig.states).toEqual(['PLAYING', 'STOPPED'])
    expect(rig.sampler.releaseCount).toBe(1)
    expect(rig.timers.pendingCount).toBe(0) // 单飞纪律：停止后无复活 tick
  })

  it('空区间守卫（§2.3）：区间内无发音条目时告警并直接返回', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 10, endRv: 11, skipBeats: 0 },
    })
    await rig.engine.play() // 直接调用：守卫拒绝时不产生任何定时器
    expect(rig.engine.getState()).toBe('STOPPED')
    expect(rig.states).toEqual([])
    expect(rig.timers.pendingCount).toBe(0)
    expect(console.warn).toHaveBeenCalled()
  })

  it('未构建播放数据：play() 告警直接返回', async () => {
    const engine = new PlaybackEngine({
      bpm: 60,
      timingSource: new FakeTimingSource(60),
      sampler: new FakeSampler(),
      drawScheduler: new FakeDraw(),
      timers: new ManualTimers(),
    })
    await engine.play()
    expect(engine.getState()).toBe('STOPPED')
    expect(console.warn).toHaveBeenCalled()
  })
})

// ── 停止语义（§3.3）与变速（§3.5）─────────────────────────────────────

describe('PlaybackEngine 停止与变速', () => {
  it('stop 全停三步连续：清 tick → releaseAll → 时钟冻结锚回区间起点', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5]]), {
      loop: { startRv: 0.25, endRv: 0.75, skipBeats: 1 },
    })
    await playRig(rig)
    runMs(rig, 1200)
    expect(rig.engine.getState()).toBe('PLAYING')
    rig.engine.stop()
    expect(rig.engine.getCurrentTimestamp()).toBeCloseTo(0.25, 12) // 锚回循环起点
    expect(rig.sampler.releaseCount).toBe(1)
    expect(rig.timers.pendingCount).toBe(0)
    const callsBefore = rig.sampler.notes.length
    runMs(rig, 5000) // 停止后时间推进不复活引擎
    expect(rig.sampler.notes).toHaveLength(callsBefore)
    expect(rig.states).toEqual(['PLAYING', 'STOPPED'])
  })

  it('空拍等待期间 stop：空拍定时器一并清除，不回跳', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 1 },
    })
    await playRig(rig)
    runMs(rig, 2000)
    expect(rig.timers.pendingCount).toBe(1) // 只有空拍定时器（单飞）
    rig.engine.stop()
    expect(rig.timers.pendingCount).toBe(0)
    const iterationsBefore = rig.iterations.length
    rig.timers.runAll()
    expect(rig.iterations).toHaveLength(iterationsBefore)
    expect(rig.engine.getState()).toBe('STOPPED')
  })

  it('播放中 setBpm：传播到时钟、后续时长按新速换算（决策 A2）', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5]]))
    await playRig(rig)
    runMs(rig, 1200) // ts 越过 0.25 rv
    const tsBefore = rig.engine.getCurrentTimestamp()
    rig.engine.setBpm(120)
    expect(rig.timing.bpm).toBe(120)
    expect(rig.engine.getCurrentTimestamp()).toBeCloseTo(tsBefore, 12) // 变速不跳时刻
    runMs(rig, 1500)
    const third = rig.sampler.notes.find((note) => note.note === 'n2')
    expect(third).toBeDefined()
    expect(third?.duration).toBeCloseTo(0.5, 9) // 0.25 rv @120
  })
})

// ── 节拍器（§3.7）──────────────────────────────────────────────────────

describe('PlaybackEngine 节拍器', () => {
  it('拍点等间隔调度：强/弱拍音量与 beatsPerMeasure 判定', async () => {
    const rig = createRig(melody([[0], [0.25], [0.5], [0.75]]), {
      metronome: { enabled: true, beatsPerMeasure: 3 },
    })
    await playRig(rig)
    runMs(rig, 3100) // 覆盖 0 / 1 / 2 / 3 拍（@60 每 1s 一拍，音频钟秒域 1000 + k）
    const hits = rig.metronomeVoices[0]!.hits
    expect(hits).toHaveLength(4)
    expect(hits[0]).toEqual({ when: 1000, velocity: 0.8, isStrong: true })
    expect(hits[1]!.when).toBeCloseTo(1001, 6)
    expect(hits[1]!.velocity).toBe(0.5)
    expect(hits[1]!.isStrong).toBe(false)
    expect(hits[2]!.when).toBeCloseTo(1002, 6)
    expect(hits[2]!.isStrong).toBe(false)
    expect(hits[3]!.when).toBeCloseTo(1003, 6)
    expect(hits[3]!.velocity).toBe(0.8)
    expect(hits[3]!.isStrong).toBe(true)
  })

  it('循环回跳节拍计数按起点重推（拍点全曲绝对，强拍对齐小节）', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 0 },
      metronome: { enabled: true, beatsPerMeasure: 4 },
    })
    await playRig(rig)
    runMs(rig, 2100) // 触发一次回跳
    const strongWhens = rig.metronomeVoices[0]!.hits.filter((hit) => hit.isStrong).map((hit) => hit.when)
    // 回跳后从拍 0 重新起：强拍再次落在回跳后的区间起点（when = 起播音频秒 1000）
    expect(strongWhens.some((when) => Math.abs(when - 1000) < 1e-6)).toBe(true)
    expect(rig.engine.getState()).toBe('PLAYING')
  })

  it('起拍点节拍不被首 tick 定时器延迟吞掉（回看线 = 安全间隔；真实 setTimeout(0) ≥1ms 会越过 ε 线）', async () => {
    const rig = createRig(melody([[0]]), { metronome: { enabled: true } })
    await rig.engine.play()
    rig.timing.advanceMs(3) // 模拟真实浏览器 setTimeout(0) 的最小延迟
    rig.timers.runNext()
    rig.draw.flush()
    const hits = rig.metronomeVoices[0]!.hits
    expect(hits).toHaveLength(1)
    expect(hits[0]!.isStrong).toBe(true)
    expect(hits[0]!.when).toBeCloseTo(1000, 2) // when 钳到当前音频钟（含模拟延迟 3ms）
  })

  it('循环回跳后的起拍节拍同样不被定时器延迟吞掉', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 0 },
      metronome: { enabled: true },
    })
    await rig.engine.play()
    step(rig) // 首 tick：强拍 @1000
    runMs(rig, 2000) // tick @1001（弱拍）；tick 越过循环终点 → 空拍等待（setTimeout(0) 挂起）
    rig.timers.runNext() // 空拍计时到 → 回跳 + 排下一 tick
    rig.timing.advanceMs(3) // 模拟真实定时器延迟：时钟越过回跳点
    rig.timers.runNext()
    rig.draw.flush()
    const strongs = rig.metronomeVoices[0]!.hits.filter((hit) => hit.isStrong).map((hit) => hit.when)
    expect(strongs).toHaveLength(2)
    expect(strongs[1]).toBeCloseTo(1002, 2) // 回跳后的强拍立即补上（钳到当前音频钟，含模拟延迟）
  })

  it('生命周期：音色/开关变化重建声部，音量变化只改字段（§3.7）', () => {
    const rig = createRig(melody([[0]]))
    rig.engine.setMetronome({ enabled: true })
    expect(rig.metronomeVoices).toHaveLength(1)
    expect(rig.metronomeVoices[0]!.sound).toBe('classic')
    rig.engine.setMetronome({ strongVolume: 0.9 })
    expect(rig.metronomeVoices).toHaveLength(1) // 音量变化不重建
    rig.engine.setMetronome({ sound: 'kick' })
    expect(rig.metronomeVoices).toHaveLength(2)
    expect(rig.metronomeVoices[0]!.disposed).toBe(true)
    expect(rig.metronomeVoices[1]!.sound).toBe('kick')
    rig.engine.setMetronome({ enabled: false })
    expect(rig.metronomeVoices[1]!.disposed).toBe(true)
  })

  it('默认关闭：不开节拍器时拍点只推进不出声', async () => {
    const rig = createRig(melody([[0], [0.25]]))
    await playRig(rig)
    runMs(rig, 1500)
    expect(rig.metronomeVoices).toHaveLength(0)
    expect(rig.engine.getState()).toBe('PLAYING')
  })
})

// ── 事件与收尾 ─────────────────────────────────────────────────────────

describe('PlaybackEngine 事件与收尾', () => {
  it('iteration 只经 Draw 发射；resetOccurred 仅回跳时为真', async () => {
    const rig = createRig(melody([[0], [0.25]]), {
      loop: { startRv: 0, endRv: 0.5, skipBeats: 0 },
    })
    await playRig(rig)
    runMs(rig, 2100)
    const resets = rig.iterations.filter((event) => event.resetOccurred)
    const notes = rig.iterations.filter((event) => !event.resetOccurred)
    expect(resets.length).toBeGreaterThanOrEqual(1)
    expect(notes.length).toBeGreaterThanOrEqual(2)
    expect(notes.every((event) => !event.resetOccurred)).toBe(true)
  })

  it('reset（接线序列末步）：停止态定位到区间起点、时钟锚定', () => {
    const rig = createRig(melody([[0.5], [0.75]]), {
      loop: { startRv: 0.5, endRv: 1, skipBeats: 0 },
    })
    rig.engine.reset()
    expect(rig.engine.getCurrentTimestamp()).toBeCloseTo(0.5, 12)
  })

  it('dispose：停止 + 节拍器声部释放 + 事件清空', async () => {
    const rig = createRig(melody([[0]]), { metronome: { enabled: true } })
    await playRig(rig)
    rig.engine.dispose()
    expect(rig.engine.getState()).toBe('STOPPED')
    expect(rig.metronomeVoices[0]!.disposed).toBe(true)
    expect(rig.timers.pendingCount).toBe(0)
    expect(() => rig.engine.stop()).not.toThrow()
  })

  it('乐器切换仅在停止态（§3.6）：播放中 setSampler 被忽略', async () => {
    const rig = createRig(melody([[0]]))
    await playRig(rig)
    const replacement = new FakeSampler()
    rig.engine.setSampler(replacement)
    rig.engine.stop()
    expect(replacement.releaseCount).toBe(0) // 替换未生效
  })
})
