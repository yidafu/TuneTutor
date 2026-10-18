/**
 * 播放引擎（docs/audio.md §3，官方 PlaybackManager 同构）：
 * look-ahead 窗口自调度 tick（100ms 窗口、≤50ms 收敛、整毫秒 when）、引擎内循环状态机
 * （回跳 + 空拍等待 + 单飞纪律）、tick 内逐拍调度节拍器、iteration/state-change 两级事件
 * （iteration 经 Draw 对齐 rAF，过期 >250ms 丢弃由 Draw 实现保证）。
 * 本文件不依赖 Tone.js：时钟、采样器、Draw、音频解锁、定时器全部注入（决策 A12），
 * Tone 接线默认件集中在 InstrumentLoader.ts。RealValue 域比较统一带容差 1e-4（决策 A10）。
 * 停止语义（§3.3 硬约束）：清 pending tick → sampler.releaseAll() → 时钟冻结+锚回区间起点，
 * 三步连续完成；同一时刻至多一个 pending tick（单飞纪律，§3.1）。
 */
import type { MetronomeSoundType } from '../types/audio'
import type { LoopRange, PlaybackEntry } from '../types/playback'
import type { TimingSource } from './TimingSource'
import { beatsToSeconds, realValueToSeconds, secondsToRealValue } from './TempoConverter'

/** look-ahead 窗口宽（官方 PlaybackAudioLookAheadMs 同值，audio.md §3.1） */
export const LOOK_AHEAD_MS = 100
/** tick 自调度收敛参数：wait = min(距下一事件, max(10, LOOK_AHEAD_MS/2))（官方同款） */
export const TICK_MIN_WAIT_MS = 10
export const TICK_MAX_WAIT_MS = LOOK_AHEAD_MS / 2
/** 定位安全间隔 RealValue（官方 PlaybackSkipNotesSafetyInterval 同值，audio.md §2.3） */
export const SKIP_NOTES_SAFETY_RV = 0.02
/** RealValue 域时间比较容差（audio.md §2.5，决策 A10；禁止裸 ===/<） */
export const ENGINE_RV_EPSILON = 1e-4
/** 音符力度固定值（audio.md §3.1-④；力度链为 §8 候选） */
export const NOTE_VELOCITY = 0.7
/** 每 tick 节拍调度上限（官方每 tick ≤64 拍防爆量） */
const MAX_BEATS_PER_TICK = 64

export type PlaybackState = 'PLAYING' | 'STOPPED'

/** 采样器最小接口（Tone.Sampler 的结构子集；测试用 fake 实现） */
export interface PlaybackSampler {
  triggerAttackRelease(
    note: string,
    durationSeconds: number,
    whenSeconds: number,
    velocity?: number,
  ): unknown
  releaseAll(): unknown
}

/** Draw 对齐调度器（Tone.Draw 的结构子集；搬到最近 rAF、过期即弃由实现负责） */
export interface DrawScheduler {
  schedule(callback: () => void, whenSeconds: number): unknown
}

/** 可注入定时器（测试用手动队列替换 setTimeout/clearTimeout，保证确定性驱动） */
export interface EngineTimers {
  set(handler: () => void, ms: number): number
  clear(id: number): void
}

/** 节拍器声部：音色/音高/时长细节由实现封装，引擎只给时刻、力度、强弱（audio.md §3.7） */
export interface MetronomeVoice {
  trigger(whenSeconds: number, velocity: number, isStrong: boolean): void
  dispose(): void
}

/** 节拍器设置：全部显式字段（决策 A11，无隐式总闸）；默认值见 engine 字段初始化 */
export interface MetronomeSettings {
  enabled: boolean
  sound: MetronomeSoundType
  strongVolume: number
  weakVolume: number
  /** 拍号分子（强拍判定 beatCounter % beatsPerMeasure === 0） */
  beatsPerMeasure: number
  /** 拍号分母（一拍 = 1/beatValue RealValue，4/4 即 0.25） */
  beatValue: number
}

export interface PlaybackEngineOptions {
  bpm: number
  timingSource: TimingSource
  sampler: PlaybackSampler
  drawScheduler: DrawScheduler
  timers?: EngineTimers
  /** 音频解锁（play() 首步，须在用户手势内调用链上；被拒即放弃本次播放） */
  ensureAudioContext?: () => Promise<void>
  metronomeFactory?: (sound: MetronomeSoundType) => MetronomeVoice
}

export interface PlaybackIterationEvent {
  /** 本次发音条目；回跳/重定位事件为定位后首条目（无发音条目时 null） */
  entry: PlaybackEntry | null
  /** 循环回跳/重新定位标志（官方 ResetOccurred 同构；光标回卷用显式标志而非时间比较） */
  resetOccurred: boolean
}

const defaultTimers: EngineTimers = {
  set: (handler, ms) => window.setTimeout(handler, ms),
  clear: (id) => window.clearTimeout(id),
}

export class PlaybackEngine {
  private bpm: number
  private readonly timingSource: TimingSource
  private sampler: PlaybackSampler
  private readonly drawScheduler: DrawScheduler
  private readonly timers: EngineTimers
  private readonly ensureAudioContext: () => Promise<void>
  private readonly metronomeFactory: ((sound: MetronomeSoundType) => MetronomeVoice) | null

  private entries: PlaybackEntry[] = []
  /** 数据终点 = 末条目末刻：自动停止等最后一音播完（audio.md §2.2-7） */
  private playbackEndRv = 0
  private loop: LoopRange | null = null
  private state: PlaybackState = 'STOPPED'

  private nextEntryIndex = 0
  /** 最近一次入窗条目的下标（−1 = 定位后尚未发声）：光标重同步与进度直读的支点（§3.8） */
  private currentIndex = -1
  private nextBeatRv = 0
  private beatCounter = 0

  // 节拍器默认值即决策记录（A11）：enabled=false（对齐官方 DoPreCount=false 与页面默认），
  // sound/volumes 对齐 localStorage 默认；无任何隐式出声总闸
  private metronome: MetronomeSettings = {
    enabled: false,
    sound: 'classic',
    strongVolume: 0.8,
    weakVolume: 0.5,
    beatsPerMeasure: 4,
    beatValue: 4,
  }
  private metronomeVoice: MetronomeVoice | null = null

  private pendingTickId: number | null = null
  private gapTimeoutId: number | null = null
  private gapWaiting = false
  private playSequence = 0
  private readonly iterationHandlers = new Set<(event: PlaybackIterationEvent) => void>()
  private readonly stateHandlers = new Set<(state: PlaybackState) => void>()

  private readonly tick = (): void => {
    this.pendingTickId = null
    if (this.state !== 'PLAYING' || this.gapWaiting) return
    this.handleTick()
  }

  constructor(options: PlaybackEngineOptions) {
    this.bpm = options.bpm
    this.timingSource = options.timingSource
    this.sampler = options.sampler
    this.drawScheduler = options.drawScheduler
    this.timers = options.timers ?? defaultTimers
    this.ensureAudioContext = options.ensureAudioContext ?? (() => Promise.resolve())
    this.metronomeFactory = options.metronomeFactory ?? null
  }

  // ── 事件（§3.8：只有 iteration / state-change 两级）───────────────────

  onIteration(handler: (event: PlaybackIterationEvent) => void): () => void {
    this.iterationHandlers.add(handler)
    return () => this.iterationHandlers.delete(handler)
  }

  onStateChange(handler: (state: PlaybackState) => void): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  // ── 接线（官方 premium 每次渲染后重挂同构，§3.2）：stop() → load → setLoop → reset()

  load(entries: PlaybackEntry[]): void {
    this.entries = entries
    const last = entries[entries.length - 1]
    this.playbackEndRv = last === undefined ? 0 : last.startRv + last.durationRv
  }

  /** 播放中改变选择：只写循环状态，当前段播完回跳时按新边界执行（selection.md §4.5） */
  setLoop(range: LoopRange | null): void {
    this.loop = range
  }

  /** BPM 变更即时重锚定（决策 A2）：不停止、零重建 */
  setBpm(bpm: number): void {
    this.bpm = bpm
    this.timingSource.setBpm(bpm)
  }

  /** 乐器切换仅在停止态（§3.6）；播放中调用直接忽略 */
  setSampler(sampler: PlaybackSampler): void {
    if (this.state === 'PLAYING') return
    this.sampler = sampler
  }

  setMetronome(settings: Partial<MetronomeSettings>): void {
    const prev = this.metronome
    this.metronome = { ...prev, ...settings }
    if (this.metronome.enabled) {
      // 音色变化或从关到开 → 重建声部；音量/拍号变化只改字段（§3.7 生命周期）
      if (this.metronomeVoice === null || this.metronome.sound !== prev.sound) {
        this.rebuildMetronomeVoice()
      }
    } else if (this.metronomeVoice !== null) {
      this.metronomeVoice.dispose()
      this.metronomeVoice = null
    }
  }

  // ── 查询（usePlayback 进度 = 时钟直读，§3.8）──────────────────────────

  getState(): PlaybackState {
    return this.state
  }

  getCurrentTimestamp(): number {
    return this.timingSource.getCurrentTimestamp()
  }

  /** 当前播放区间（循环区间或全曲）：进度归一化基准 */
  getPlaybackRange(): { startRv: number; endRv: number } {
    if (this.loop !== null) return { startRv: this.loop.startRv, endRv: this.loop.endRv }
    return { startRv: 0, endRv: this.playbackEndRv }
  }

  /** 引擎迭代器指针直读（audio.md §3.8）：最近入窗条目下标，−1 = 尚未发声 */
  getCurrentEntryIndex(): number {
    return this.currentIndex
  }

  // ── 播放控制 ─────────────────────────────────────────────────────────

  /**
   * play() 调用序列（§3.2）：音频解锁（被拒即放弃）→ 空区间守卫（§2.3）→ 定位区间起点
   * → 时钟锚点设在起点（时间戳保持全曲绝对、不平移）→ 启动 tick → emit PLAYING。
   */
  async play(): Promise<void> {
    if (this.state === 'PLAYING') return
    if (this.entries.length === 0) {
      console.warn('[PlaybackEngine] play() skipped: playback data not built')
      return
    }
    const range = this.getPlaybackRange()
    // 空区间守卫：首小节可能全是休止符（spike V6），区间内无发音条目直接返回
    const firstIndex = this.findPositionIndex(range.startRv)
    if (
      firstIndex >= this.entries.length ||
      this.entries[firstIndex]!.startRv > range.endRv + ENGINE_RV_EPSILON
    ) {
      console.warn('[PlaybackEngine] play() skipped: no audible entry in range', range)
      return
    }
    const sequence = ++this.playSequence
    try {
      await this.ensureAudioContext()
    } catch {
      console.warn('[PlaybackEngine] play() skipped: audio context unavailable')
      return
    }
    if (sequence !== this.playSequence) return // 等待期间被 stop()：本次放弃
    this.clearGapWait()
    this.positionAt(range.startRv)
    this.timingSource.setTimestampAndBpm(range.startRv, this.bpm)
    this.timingSource.start()
    this.setState('PLAYING')
    this.scheduleTick(0)
  }

  /**
   * 停止（§3.3 顺序固定）：清 pending tick → releaseAll 全停 → 清空拍等待 → 时钟冻结 +
   * 锚回区间起点（§2.3 锚点模型下的 reset）→ 循环/迭代/节拍计数归位 → emit STOPPED。
   */
  stop(): void {
    if (this.state === 'STOPPED') return
    this.playSequence += 1 // 使 play() 在途的音频解锁失效
    this.clearPendingTick()
    this.sampler.releaseAll()
    this.clearGapWait()
    const range = this.getPlaybackRange()
    this.timingSource.pause()
    this.timingSource.setTimestampAndBpm(range.startRv, this.bpm)
    this.positionAt(range.startRv)
    this.setState('STOPPED')
  }

  /** 定位到播放区间起点（接线序列末步；仅停止态） */
  reset(): void {
    if (this.state === 'PLAYING') return
    const range = this.getPlaybackRange()
    this.positionAt(range.startRv)
    this.timingSource.setTimestampAndBpm(range.startRv, this.bpm)
  }

  /** 卸载：停止 + 释放节拍器声部 + 清事件监听（采样器由 InstrumentLoader.disposeInstruments 释放） */
  dispose(): void {
    this.stop()
    this.metronomeVoice?.dispose()
    this.metronomeVoice = null
    this.iterationHandlers.clear()
    this.stateHandlers.clear()
  }

  // ── 内部：定位与节拍计数 ─────────────────────────────────────────────

  /**
   * 定位（§2.3）：二分找首个 startRv ≥ 起点 − 安全间隔的条目；已结束或已开始超过安全间隔
   * （0.02 RealValue，官方 PlaybackSkipNotesSafetyInterval 同值）的条目不补播。
   * 同时重推节拍计数：拍点全曲绝对，强拍判定与小节对齐（§3.4）。
   */
  private positionAt(startRv: number): void {
    this.nextEntryIndex = this.findPositionIndex(startRv)
    this.currentIndex = this.nextEntryIndex - 1
    const beatRv = 1 / this.metronome.beatValue
    const k = Math.ceil((startRv - ENGINE_RV_EPSILON) / beatRv)
    this.beatCounter = k
    this.nextBeatRv = k * beatRv
  }

  private findPositionIndex(startRv: number): number {
    const target = startRv - SKIP_NOTES_SAFETY_RV
    let lo = 0
    let hi = this.entries.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.entries[mid]!.startRv < target - ENGINE_RV_EPSILON) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  // ── 内部：look-ahead 调度 ────────────────────────────────────────────

  private scheduleTick(delayMs: number): void {
    this.clearPendingTick()
    this.pendingTickId = this.timers.set(this.tick, delayMs)
  }

  private clearPendingTick(): void {
    if (this.pendingTickId !== null) {
      this.timers.clear(this.pendingTickId)
      this.pendingTickId = null
    }
  }

  private handleTick(): void {
    const ts = this.timingSource.getCurrentTimestamp()
    // ② 结尾/循环判定先于窗口查询（官方 handlePlaybackEvent 顺序）
    if (this.loop !== null) {
      if (ts >= this.loop.endRv - ENGINE_RV_EPSILON) {
        this.beginGapWait()
        return
      }
    } else if (ts >= this.playbackEndRv - ENGINE_RV_EPSILON) {
      this.stop() // 自动停止哨兵：等最后一音播完（§2.2-7）
      return
    }
    const lookaheadRv = secondsToRealValue(LOOK_AHEAD_MS / 1000, this.bpm)
    this.scheduleDueEntries(ts, lookaheadRv)
    this.scheduleDueBeats(ts, lookaheadRv)
    this.scheduleTick(this.nextTickWaitMs())
  }

  private scheduleDueEntries(ts: number, lookaheadRv: number): void {
    // 循环时窗口右端钳到 loop.endRv：循环段外的音永不入窗（回跳不炸音的 v2 等价物，§3.4）
    const rightBound = this.loop !== null ? this.loop.endRv : Number.POSITIVE_INFINITY
    const windowEnd = ts + lookaheadRv
    while (this.nextEntryIndex < this.entries.length) {
      const entry = this.entries[this.nextEntryIndex]!
      if (entry.startRv >= rightBound - ENGINE_RV_EPSILON) break
      if (entry.startRv > windowEnd + ENGINE_RV_EPSILON) break
      if (entry.startRv >= ts - SKIP_NOTES_SAFETY_RV - ENGINE_RV_EPSILON) {
        // 已开始超过安全间隔的条目不补播（§2.3）；安全间隔内的定位补播音 when 钳到当前
        const waitMs = Math.max(0, this.timingSource.getWaitingTimeInMs(entry.startRv))
        const when = this.timingSource.getAudioNowSeconds() + waitMs / 1000
        this.sampler.triggerAttackRelease(
          entry.noteName,
          realValueToSeconds(entry.durationRv, this.bpm),
          when,
          NOTE_VELOCITY,
        )
        const captured = entry
        this.drawScheduler.schedule(
          () => this.emitIteration({ entry: captured, resetOccurred: false }),
          when,
        )
      }
      this.nextEntryIndex += 1
    }
    this.currentIndex = this.nextEntryIndex - 1
  }

  /** 自调度收敛（§3.1）：wait = min(距下一事件, max(10, LOOK_AHEAD/2))，round 整毫秒 */
  private nextTickWaitMs(): number {
    let nextRv = Number.POSITIVE_INFINITY
    if (this.nextEntryIndex < this.entries.length) {
      nextRv = this.entries[this.nextEntryIndex]!.startRv
    }
    nextRv = Math.min(nextRv, this.nextBeatRv)
    nextRv = Math.min(nextRv, this.loop !== null ? this.loop.endRv : this.playbackEndRv)
    const waitMs = this.timingSource.getWaitingTimeInMs(nextRv)
    return Math.min(Math.max(waitMs, 0), Math.max(TICK_MIN_WAIT_MS, TICK_MAX_WAIT_MS))
  }

  // ── 内部：循环状态机与节拍器 ─────────────────────────────────────────

  /**
   * 空拍等待（官方 LoopPauseMs 同构）：tick 判定越过循环终点 → 挂起 tick（单飞）→
   * setTimeout(beatsToSeconds(skipBeats) × 1000) 后回跳；0 拍 = setTimeout(0) 立即回跳。
   * 空拍秒数随 BPM 现算、不缓存（决策 A3）；无事件等待，不调度静音音符（决策 A4）。
   */
  private beginGapWait(): void {
    if (this.gapWaiting || this.loop === null) return
    this.clearPendingTick()
    this.gapWaiting = true
    const gapMs = Math.max(0, Math.round(beatsToSeconds(this.loop.skipBeats, this.bpm) * 1000))
    this.gapTimeoutId = this.timers.set(() => {
      this.gapTimeoutId = null
      this.gapWaiting = false
      if (this.state !== 'PLAYING') return
      this.jumpBack()
      this.scheduleTick(0)
    }, gapMs)
  }

  /** 循环回跳：迭代位置/节拍计数重置到循环起点，时钟重锚定，广播 resetOccurred（§3.4/§3.8） */
  private jumpBack(): void {
    const startRv = this.loop !== null ? this.loop.startRv : 0
    this.positionAt(startRv)
    this.timingSource.setTimestampAndBpm(startRv, this.bpm)
    const next =
      this.nextEntryIndex < this.entries.length ? this.entries[this.nextEntryIndex] : undefined
    this.emitIteration({ entry: next ?? null, resetOccurred: true })
  }

  private clearGapWait(): void {
    this.gapWaiting = false
    if (this.gapTimeoutId !== null) {
      this.timers.clear(this.gapTimeoutId)
      this.gapTimeoutId = null
    }
  }

  /** 拍点在乐谱时域等间隔推进（§3.7）：与主播放同一速度轴，变速/回跳后不错拍 */
  private scheduleDueBeats(ts: number, lookaheadRv: number): void {
    const beatRv = 1 / this.metronome.beatValue
    const rightBound = this.loop !== null ? this.loop.endRv : this.playbackEndRv
    const windowEnd = ts + lookaheadRv
    let scheduled = 0
    while (scheduled < MAX_BEATS_PER_TICK) {
      if (this.nextBeatRv >= rightBound - ENGINE_RV_EPSILON) break
      if (this.nextBeatRv > windowEnd + ENGINE_RV_EPSILON) break
      if (
        // 「过去」判定线与条目一致用安全间隔（§2.3）：真实 setTimeout(0) 的 ≥1ms 延迟
        // 足以越过 ε 线，起拍/回跳点节拍曾被吞、节拍器听感慢一拍进来（2026-10-18 实测修复）
        this.nextBeatRv >= ts - SKIP_NOTES_SAFETY_RV - ENGINE_RV_EPSILON &&
        this.metronome.enabled &&
        this.metronomeVoice !== null
      ) {
        const isStrong = this.beatCounter % this.metronome.beatsPerMeasure === 0
        const velocity = isStrong ? this.metronome.strongVolume : this.metronome.weakVolume
        const waitMs = Math.max(0, this.timingSource.getWaitingTimeInMs(this.nextBeatRv))
        this.metronomeVoice.trigger(
          this.timingSource.getAudioNowSeconds() + waitMs / 1000,
          velocity,
          isStrong,
        )
      }
      this.nextBeatRv += beatRv
      this.beatCounter += 1
      scheduled += 1
    }
  }

  private rebuildMetronomeVoice(): void {
    if (this.metronomeFactory === null) return
    this.metronomeVoice?.dispose()
    this.metronomeVoice = this.metronomeFactory(this.metronome.sound)
  }

  // ── 事件发射 ─────────────────────────────────────────────────────────

  private setState(state: PlaybackState): void {
    this.state = state
    for (const handler of this.stateHandlers) handler(state)
  }

  private emitIteration(event: PlaybackIterationEvent): void {
    for (const handler of this.iterationHandlers) handler(event)
  }
}
