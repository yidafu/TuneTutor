/**
 * 播放状态机 + 进度推导（docs/tech.md §2.1、docs/audio.md §3.8）。
 * 持有 PlaybackEngine 生命周期（挂载创建/卸载 dispose，tech.md §2.3 离开页面停止），
 * 把速度/乐器/节拍器/播放数据/循环区间同步进引擎；进度不走事件流，播放期间轮询
 * 引擎时钟并相对当前播放区间（全曲或循环区间）归一。
 * 接线序列（audio.md §3.2，引擎就绪或新播放数据装载时）：stop → load → setLoop → reset；
 * 播放中改选择/空拍只写循环状态、回跳时按新边界执行（§3.4）。
 * 采样加载窗口对 UI 暴露：samplesLoading / samplesFailed / retrySamples（就绪前 play 守住）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createScorePlaybackEngine, loadInstrument } from '../audio/InstrumentLoader'
import { ENGINE_RV_EPSILON, PlaybackEngine } from '../audio/PlaybackEngine'
import type { MetronomeSettings } from '../audio/PlaybackEngine'
import type { InstrumentType } from '../types/audio'
import type { LoopRange, PlaybackEntry } from '../types/playback'
import { computeLoopRange, dataEndRv, type ScoreSelection } from '../utils/notation/selection'

/** 循环区间推导（audio.md §3.4 范围优先级唯一入口）：选择（乐句/小节/框选）> 空拍循环全曲 > 顺序播放 */
export function deriveLoopRange(
  selection: ScoreSelection | null,
  entries: readonly PlaybackEntry[],
  skipBeats: number,
): LoopRange | null {
  if (selection !== null) return computeLoopRange(selection, entries, skipBeats)
  if (skipBeats > 0 && entries.length > 0) {
    return { startRv: 0, endRv: dataEndRv(entries), skipBeats }
  }
  return null
}

export interface UsePlaybackOptions {
  /** 两页共享的播放速度（App 持有，tech.md §2.3）；变更即时重锚定（决策 A2） */
  tempo: number
  instrument: InstrumentType
  metronome: MetronomeSettings
  /** 播放数据（OsmdNotation 装载新谱后上报；数组身份只在换谱时变化） */
  entries: PlaybackEntry[]
  selection: ScoreSelection | null
  skipBeats: number
  /** 引擎工厂（默认真实装配；测试注入同步 fake） */
  createEngine?: (bpm: number) => Promise<PlaybackEngine>
}

export interface PlaybackController {
  /** 引擎就绪（钢琴采样预载完成）；就绪前 play 无效 */
  ready: boolean
  playing: boolean
  /** 相对当前播放区间归一的进度 0–1；停止态归零 */
  progress: number
  /** 当前乐器采样加载中（首次为钢琴预载窗口；切换乐器后为新音色加载窗口）：
   * 未就绪期间音符会被引擎静默丢弃，UI 需显示加载态并把 play 守住 */
  samplesLoading: boolean
  /** 采样加载失败（网络等）：ready 以 reject 上报，UI 显示失败 + 重试 */
  samplesFailed: boolean
  play(): void
  stop(): void
  toggle(): void
  /** 重试采样加载（引擎创建失败时重建引擎；乐器失败时重建采样器） */
  retrySamples(): void
  /** 引擎实例（OsmdNotation 光标跟随订阅用）；未就绪为 null */
  engine: PlaybackEngine | null
}

/** 拍号字符串 "4/4" → 拍号分子/分母（非法回落 4/4；节拍器强拍判定与拍点间隔用） */
export function parseTimeSignature(timeSignature: string): { beatsPerMeasure: number; beatValue: number } {
  const [beats, beatType] = timeSignature.split('/')
  const numerator = Number.parseInt(beats ?? '', 10)
  const denominator = Number.parseInt(beatType ?? '', 10)
  return {
    beatsPerMeasure: Number.isFinite(numerator) && numerator > 0 ? numerator : 4,
    beatValue: Number.isFinite(denominator) && denominator > 0 ? denominator : 4,
  }
}

export function usePlayback(options: UsePlaybackOptions): PlaybackController {
  const { tempo, instrument, metronome, entries, selection, skipBeats } = options

  const [engine, setEngine] = useState<PlaybackEngine | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  // 采样就绪状态：engine null（钢琴预载窗口）或当前乐器缓冲未就绪都算加载中；
  // ready 前 triggerAttackRelease 被静默丢弃 → play 必须守住，否则「点击播放无声」无解释
  const [samplerReady, setSamplerReady] = useState(false)
  const [samplerFailed, setSamplerFailed] = useState(false)
  // 重试计数：retrySamples 递增以重跑引擎创建/乐器加载 effect
  const [retrySeq, setRetrySeq] = useState(0)
  const engineRef = useRef<PlaybackEngine | null>(null)
  const loopRangeRef = useRef<LoopRange | null>(null)
  const samplerReadyRef = useRef(false)

  // 工厂取首次提供的（测试注入 inline 箭头不会反复重建引擎）；tempo 初值即工厂入参
  const createEngineRef = useRef(options.createEngine ?? createScorePlaybackEngine)
  const initialTempoRef = useRef(tempo)

  // 挂载创建引擎（构造即预载钢琴，§3.6）；卸载 dispose（内含全停，tech.md §2.3）。
  // 创建失败（钢琴采样加载 reject）：置失败态交 UI 重试；retrySeq 重跑本 effect
  useEffect(() => {
    let cancelled = false
    void createEngineRef.current(initialTempoRef.current)
      .then((created) => {
        if (cancelled) {
          created.dispose()
          return
        }
        engineRef.current = created
        setEngine(created)
      })
      .catch(() => {
        if (!cancelled) setSamplerFailed(true)
      })
    return () => {
      cancelled = true
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [retrySeq])

  // samplerReady 镜像进 ref：play/toggle 回调零依赖，守卫读到的是最新值
  useEffect(() => {
    samplerReadyRef.current = samplerReady
  }, [samplerReady])

  // 循环区间推导
  const loopRange = useMemo(
    () => deriveLoopRange(selection, entries, skipBeats),
    [selection, entries, skipBeats],
  )
  useEffect(() => {
    loopRangeRef.current = loopRange
  }, [loopRange])

  // 接线序列（§3.2）：引擎就绪或新播放数据装载后 stop → load → setLoop → reset。
  // entries 数组身份只在换谱时变化（OsmdNotation 仅装载时上报），同谱重渲染不打断播放。
  useEffect(() => {
    const current = engineRef.current
    if (current === null) return
    current.stop()
    current.load(entries)
    current.setLoop(loopRangeRef.current)
    current.reset()
  }, [engine, entries])

  // 播放中改选择/空拍：只写循环状态（selection.md §4.5）；停止态重新定位到区间起点
  useEffect(() => {
    const current = engineRef.current
    if (current === null) return
    current.setLoop(loopRange)
    if (current.getState() === 'STOPPED') current.reset()
  }, [engine, loopRange])

  // 变速即时重锚定（决策 A2）：不停止、零重建
  useEffect(() => {
    engineRef.current?.setBpm(tempo)
  }, [engine, tempo])

  // 乐器切换仅停止态生效（§3.6）：播放中引擎忽略 setSampler，停止后（playing 翻转）重新应用。
  // 就绪跟踪：缓存命中即时就绪；新加载则挂 ready——resolve 置就绪、reject 置失败（retrySamples 重跑）
  useEffect(() => {
    const current = engineRef.current
    if (current === null) return
    let cancelled = false
    void loadInstrument(instrument)
      .then((loaded) => {
        if (cancelled) return
        current.setSampler(loaded.sampler)
        setSamplerReady(loaded.isReady())
        if (!loaded.isReady()) {
          void loaded.ready
            .then(() => {
              if (!cancelled) setSamplerReady(true)
            })
            .catch(() => {
              if (!cancelled) setSamplerFailed(true)
            })
        }
      })
      .catch(() => {
        if (!cancelled) setSamplerFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [engine, instrument, playing, retrySeq])

  // 节拍器（§3.7 生命周期在引擎内：音色/开关变化重建声部、音量只改字段）
  useEffect(() => {
    engineRef.current?.setMetronome(metronome)
  }, [engine, metronome])

  // 状态事件 → playing；停止态进度归零
  useEffect(() => {
    if (engine === null) return
    return engine.onStateChange((state) => {
      setPlaying(state === 'PLAYING')
      if (state === 'STOPPED') setProgress(0)
    })
  }, [engine])

  // 进度轮询（§3.8）：与调度同出一个时钟（D1），rAF 缺失时降级 100ms 定时器
  useEffect(() => {
    if (engine === null || !playing) return
    let frameId: number | null = null
    let intervalId: number | null = null
    const tick = (): void => {
      const range = engine.getPlaybackRange()
      const span = range.endRv - range.startRv
      if (span <= ENGINE_RV_EPSILON) {
        setProgress(0)
        return
      }
      const value = (engine.getCurrentTimestamp() - range.startRv) / span
      setProgress(Math.min(1, Math.max(0, value)))
    }
    if (typeof requestAnimationFrame === 'function') {
      const loop = (): void => {
        tick()
        frameId = requestAnimationFrame(loop)
      }
      frameId = requestAnimationFrame(loop)
    } else {
      intervalId = window.setInterval(tick, 100)
    }
    return () => {
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId)
      }
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [engine, playing])

  // 采样未就绪时 play 守住（按钮禁用 + 键盘走带同源，避免「点了没声」无解释）；
  // 播放中不拦 stop（toggle 的停止分支永远可达）
  const play = useCallback(() => {
    if (!samplerReadyRef.current) return
    void engineRef.current?.play()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    const current = engineRef.current
    if (current === null) return
    if (current.getState() === 'PLAYING') {
      current.stop()
      return
    }
    if (!samplerReadyRef.current) return
    void current.play()
  }, [])

  // 重试：清失败态并递增计数，引擎创建（钢琴失败）与乐器加载两个 effect 随之重跑
  const retrySamples = useCallback(() => {
    setSamplerFailed(false)
    setSamplerReady(false)
    setRetrySeq((seq) => seq + 1)
  }, [])

  return {
    ready: engine !== null,
    playing,
    progress,
    samplesLoading: !samplerReady,
    samplesFailed: samplerFailed,
    play,
    stop,
    toggle,
    retrySamples,
    engine,
  }
}
