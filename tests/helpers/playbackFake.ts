import type {
  DrawScheduler,
  EngineTimers,
  MetronomeVoice,
  PlaybackSampler,
} from '@/audio/PlaybackEngine'
import type { MetronomeSoundType } from '@/types/audio'
import type { TimingSource } from '@/audio/TimingSource'
import { realValueToSeconds } from '@/audio/TempoConverter'

/**
 * 播放域测试替身（docs/audio.md §7：fake 时钟 + fake 采样器 + 手动定时器）。
 * PlaybackEngine 与 usePlayback 测试共用；FakeTimingSource 与 LinearTimingSource 同契约
 * （setBpm 重锚定 + elapsed 清零；音频钟单调独立，不随乐谱重锚定回退）。
 */

export class FakeTimingSource implements TimingSource {
  private bpmValue: number
  private anchorRv = 0
  private elapsedMs = 0
  private audioClockMs = 0

  constructor(bpm: number) {
    this.bpmValue = bpm
  }

  get bpm(): number {
    return this.bpmValue
  }

  getCurrentTimestamp(): number {
    return this.anchorRv + (this.elapsedMs / 1000) * (this.bpmValue / 240)
  }

  setBpm(bpm: number): void {
    this.anchorRv = this.getCurrentTimestamp()
    this.bpmValue = bpm
    this.elapsedMs = 0
  }

  setTimestampAndBpm(timestampRv: number, bpm: number): void {
    this.anchorRv = timestampRv
    this.bpmValue = bpm
    this.elapsedMs = 0
  }

  getWaitingTimeInMs(targetRv: number): number {
    return Math.round(realValueToSeconds(targetRv - this.getCurrentTimestamp(), this.bpmValue) * 1000)
  }

  getAudioNowSeconds(): number {
    return 1000 + this.audioClockMs / 1000
  }

  start(): void {}
  pause(): void {}
  reset(): void {
    this.anchorRv = 0
    this.elapsedMs = 0
  }

  advanceMs(ms: number): void {
    this.elapsedMs += ms
    this.audioClockMs += ms
  }
}

export interface SampledNote {
  note: string
  duration: number
  when: number
  velocity: number
}

export class FakeSampler implements PlaybackSampler {
  readonly notes: SampledNote[] = []
  releaseCount = 0

  triggerAttackRelease(note: string, duration: number, when: number, velocity?: number): void {
    this.notes.push({ note, duration, when, velocity: velocity ?? -1 })
  }

  releaseAll(): void {
    this.releaseCount += 1
  }
}

export class FakeDraw implements DrawScheduler {
  private readonly pending: Array<{ callback: () => void; when: number }> = []
  private readonly history: Array<{ callback: () => void; when: number }> = []

  schedule(callback: () => void, when: number): void {
    this.pending.push({ callback, when })
    this.history.push({ callback, when })
  }

  get scheduledWhens(): number[] {
    return this.history.map((item) => item.when)
  }

  flush(): void {
    for (const item of this.pending.splice(0)) item.callback()
  }
}

export class ManualTimers implements EngineTimers {
  private seq = 0
  private readonly queue = new Map<number, { at: number; callback: () => void }>()
  now = 0

  set(callback: () => void, ms: number): number {
    const id = this.seq + 1
    this.seq = id
    this.queue.set(id, { at: this.now + Math.max(0, ms), callback })
    return id
  }

  clear(id: number): void {
    this.queue.delete(id)
  }

  get pendingCount(): number {
    return this.queue.size
  }

  nextDelayMs(): number | undefined {
    let min: number | undefined
    for (const item of this.queue.values()) {
      const delay = item.at - this.now
      min = min === undefined ? delay : Math.min(min, delay)
    }
    return min
  }

  runNext(): void {
    let nextId: number | null = null
    let nextAt = Number.POSITIVE_INFINITY
    for (const [id, item] of this.queue) {
      if (item.at < nextAt) {
        nextAt = item.at
        nextId = id
      }
    }
    if (nextId === null) throw new Error('ManualTimers: no pending timer')
    const item = this.queue.get(nextId)!
    this.queue.delete(nextId)
    this.now = item.at
    item.callback()
  }

  runAll(): void {
    while (this.queue.size > 0) this.runNext()
  }
}

export class FakeMetronomeVoice implements MetronomeVoice {
  readonly sound: MetronomeSoundType
  readonly hits: Array<{ when: number; velocity: number; isStrong: boolean }> = []
  disposed = false

  constructor(sound: MetronomeSoundType) {
    this.sound = sound
  }

  trigger(when: number, velocity: number, isStrong: boolean): void {
    this.hits.push({ when, velocity, isStrong })
  }

  dispose(): void {
    this.disposed = true
  }
}
