/**
 * 锚点时钟（docs/audio.md §3.9，官方 AbstractTimingSource 同构）。
 * 核心模型：getCurrentTimestamp() = anchorRv + elapsed(RealValue)；BPM 变更先把锚点
 * 改为当前时间戳再换 BPM（变速不跳时刻，决策 A2）；setTimestampAndBpm 把锚点直设到
 * 任意时间戳（起播定位与 count-in 负时间轴的支点）。
 * 时钟与音频图同源：实时实现的秒表锚定 AudioContext.currentTime，pause 冻结 /
 * start 恢复零漂移（官方全部秘密）；时钟做成可注入接口（决策 A12）。
 * 毫秒只在 getWaitingTimeInMs 边界出现且 round 整毫秒（决策 A10，§2.5）。
 */
import { realValueToSeconds, secondsToRealValue } from './TempoConverter'

export interface TimingSource {
  /** 当前乐谱时域时间戳（RealValue，全曲绝对，与 BPM 无关的域） */
  getCurrentTimestamp(): number
  /** 先把锚点改为当前时间戳，再换 BPM（变速不跳时刻） */
  setBpm(bpm: number): void
  /** 锚点直接设到任意时间戳并换 BPM（不改变冻结状态） */
  setTimestampAndBpm(timestampRv: number, bpm: number): void
  /** 到 target 的等待毫秒（round 整毫秒；target 在过去时可为负，钳制由调用方负责） */
  getWaitingTimeInMs(targetRv: number): number
  /** 音频时钟当前秒（when 计算基准；实时实现与乐谱时钟同源） */
  getAudioNowSeconds(): number
  /** 开始/恢复计时（实时实现对应 ac.resume） */
  start(): void
  /** 冻结计时（实时实现对应 ac.suspend；已排采样与时间轴同时冻结） */
  pause(): void
  /** 锚点归零并重新起算 */
  reset(): void
}

/**
 * 线性实时时钟：elapsed = 注入的 now() − lastReset（官方 LinearTimingSource 同构）。
 * now() 注入而非直接取 AudioContext.currentTime：单测无需真实音频环境；
 * 真实接线见 InstrumentLoader.createScorePlaybackEngine。
 */
export class LinearTimingSource implements TimingSource {
  private bpm: number
  private anchorRv = 0
  private lastResetSeconds: number
  private frozenElapsedSeconds = 0
  private frozen = false
  private readonly getNowSeconds: () => number

  constructor(getNowSeconds: () => number, bpm: number) {
    this.getNowSeconds = getNowSeconds
    this.bpm = bpm
    this.lastResetSeconds = getNowSeconds()
  }

  private elapsedSeconds(): number {
    if (this.frozen) return this.frozenElapsedSeconds
    return this.frozenElapsedSeconds + (this.getNowSeconds() - this.lastResetSeconds)
  }

  getCurrentTimestamp(): number {
    return this.anchorRv + secondsToRealValue(this.elapsedSeconds(), this.bpm)
  }

  setBpm(bpm: number): void {
    // 官方 AbstractTimingSource.setBpm 同款：锚点改为当前时间戳 + elapsed 清零重起算
    //（漏掉清零会把已走过的时长按新速二次计入，变速即跳时刻）
    this.anchorRv = this.getCurrentTimestamp()
    this.bpm = bpm
    this.frozenElapsedSeconds = 0
    this.lastResetSeconds = this.getNowSeconds()
  }

  setTimestampAndBpm(timestampRv: number, bpm: number): void {
    this.anchorRv = timestampRv
    this.bpm = bpm
    this.frozenElapsedSeconds = 0
    this.lastResetSeconds = this.getNowSeconds()
  }

  getWaitingTimeInMs(targetRv: number): number {
    return Math.round(realValueToSeconds(targetRv - this.getCurrentTimestamp(), this.bpm) * 1000)
  }

  getAudioNowSeconds(): number {
    return this.getNowSeconds()
  }

  start(): void {
    if (!this.frozen) return
    this.lastResetSeconds = this.getNowSeconds()
    this.frozen = false
  }

  pause(): void {
    if (this.frozen) return
    this.frozenElapsedSeconds += this.getNowSeconds() - this.lastResetSeconds
    this.frozen = true
  }

  reset(): void {
    this.anchorRv = 0
    this.frozenElapsedSeconds = 0
    this.lastResetSeconds = this.getNowSeconds()
    this.frozen = false
  }
}
