/**
 * Tone.js 边界层（docs/audio.md §4 + §3.7 节拍器音色 + §3.2 接线默认件）：
 * 12 种乐器采样器加载与缓存（决策 A6：不用 minify，全量采样；决策 A20：CDN 加速 +
 * 同源打包兜底 + 自建 Sampler——包族退化为纯 mp3 资源源，JS 不再被导入，包构造函数
 * 吞掉 onerror 的死挂缺陷不再经过；同类型并发请求共享同一实例）、4 种节拍器合成器声部、
 * 真实引擎组装（LinearTimingSource 锚定 Tone 音频时钟 + Draw + Tone.start + 预载钢琴）；
 * 采样失败经 onerror 上抛（ready reject），失败条目下次加载自动重建。
 * 本文件是 src/audio/ 中唯一 import Tone 的模块：核心（playbackData / TimingSource /
 * PlaybackEngine）保持可注入、可在无音频环境单测。
 */
import {
  MembraneSynth,
  NoiseSynth,
  Synth,
  getContext,
  getDraw,
  start as toneStart,
  Sampler,
} from 'tone'
import type { InstrumentType, MetronomeSoundType } from '../types/audio'
import { LinearTimingSource } from './TimingSource'
import { PlaybackEngine } from './PlaybackEngine'
import type { DrawScheduler, MetronomeVoice, PlaybackSampler } from './PlaybackEngine'

import { SAMPLE_SOURCES } from './sampleSources.generated'

/** 已加载音色：sampler 为引擎可注入视图（已接 destination），ready 前 triggerAttackRelease 静默丢弃 */
export interface LoadedInstrument {
  readonly type: InstrumentType
  readonly sampler: PlaybackSampler
  /** 采样全部就绪时 resolve；任一采样加载失败时 reject（UI 据此显示加载失败/重试） */
  readonly ready: Promise<void>
  isReady(): boolean
  /** 加载失败标记：失败条目不缓存复用，下次 loadInstrument 重建 */
  hasError(): boolean
  /** 释放底层采样器并移出缓存（disposeInstruments / 单个卸载用） */
  dispose(): void
}

const instrumentCache = new Map<InstrumentType, LoadedInstrument>()

function createLoadedInstrument(type: InstrumentType): LoadedInstrument {
  const source = SAMPLE_SOURCES[type]!
  let readySettled = false
  let errored = false
  let resolveReady!: () => void
  let rejectReady!: (reason?: unknown) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = () => {
      readySettled = true
      resolve()
    }
    rejectReady = () => {
      errored = true
      reject(new Error(`instrument samples failed to load: ${type}`))
    }
  })
  // 两段构造（A20）：CDN 优先（jsdelivr 版本化 URL，CORS + immutable 缓存），
  // 失败自动换同源打包采样（回应 A6「防 CDN 失效」的原始顾虑）。
  // Tone.Sampler 原生转发 onerror（旧包类吞掉它 → 加载失败死挂无 UI），此处才真正可达。
  let current: Sampler | null = null
  const startAttempt = (
    urls: Record<string, string>,
    baseUrl: string,
    /** null = 已是同源兜底，再失败即 reject（UI 显示加载失败 + 重试） */
    failover: (() => void) | null,
  ): void => {
    const sampler = new Sampler({
      urls,
      baseUrl,
      onload: () => {
        // 只认当前尝试：CDN 部分加载后失败的晚到 onload 不得误置就绪
        //（此刻 current 已换成兜底 sampler，未就绪触发会被 readySettled 守卫拦下）
        if (current === sampler) resolveReady()
      },
      onerror: () => {
        // Tone 对每个失败 buffer 各触发一次 onerror；换源后旧尝试的后续回调全部无视
        if (current !== sampler) return
        if (failover === null) {
          rejectReady()
          return
        }
        failover()
      },
    }).toDestination()
    // 统一 release 改善尾音、收紧空拍开头渗音（audio.md §3.4 已知瑕疵 / §4 可选优化）
    sampler.release = 0.8
    current = sampler
  }
  const startCdn = (): void => {
    startAttempt({ ...source.cdnUrls }, source.cdnBase, () => {
      current?.dispose()
      startBundled()
    })
  }
  const startBundled = (): void => {
    startAttempt({ ...source.bundledUrls }, '', null)
  }
  startCdn()
  const loaded: LoadedInstrument = {
    type,
    sampler: {
      triggerAttackRelease: (note, durationSeconds, whenSeconds, velocity) => {
        // ready 前静默丢弃：Tone 对未加载 buffer 抛「No available buffers for note」，
        // 异常发生在引擎 tick 内会打死自调度循环（§3.1 单飞纪律）。
        // 该守卫同时覆盖「失败后已 dispose / 换源中」的旧 wrapper：永不触达底层节点
        if (!readySettled) return
        current?.triggerAttackRelease(note, durationSeconds, whenSeconds, velocity)
      },
      releaseAll: () => {
        // ready 前不可能有已发声声部（trigger 全被丢弃），此处 no-op 即可；
        // 也避免对失败后已 dispose 的底层节点调 releaseAll 抛「disposed」
        if (!readySettled) return
        current?.releaseAll()
      },
    },
    ready,
    isReady: () => readySettled,
    hasError: () => errored,
    dispose: () => {
      current?.dispose()
      instrumentCache.delete(type)
    },
  }
  return loaded
}

/**
 * 缓存获取/加载：构造是同步的（缓冲在内部异步取），并发请求经缓存天然单飞（§4）。
 * 失败条目不缓存复用：先建新条目换入缓存再释放旧条目（引擎在 setSampler 落地前
 * 仍持旧 wrapper，其 trigger/releaseAll 已被 readySettled 守卫拦下，无 disposed 风险）。
 */
export function loadInstrument(type: InstrumentType): Promise<LoadedInstrument> {
  const cached = instrumentCache.get(type)
  if (cached !== undefined && !cached.hasError()) return Promise.resolve(cached)
  const loaded = createLoadedInstrument(type)
  instrumentCache.set(type, loaded)
  if (cached !== undefined) cached.dispose()
  return Promise.resolve(loaded)
}

export function isInstrumentLoaded(type: InstrumentType): boolean {
  return instrumentCache.get(type)?.isReady() ?? false
}

/** 全量释放（测试/卸载用，§4） */
export function disposeInstruments(): void {
  for (const loaded of [...instrumentCache.values()]) loaded.dispose()
}

// ── 节拍器（audio.md §3.7）─────────────────────────────────────────────

export function createMetronomeVoice(sound: MetronomeSoundType): MetronomeVoice {
  switch (sound) {
    case 'classic': {
      const synth = new MembraneSynth().toDestination()
      return {
        trigger: (when, velocity, isStrong) => {
          synth.triggerAttackRelease(isStrong ? 'C4' : 'C3', '16n', when, velocity)
        },
        dispose: () => {
          synth.dispose()
        },
      }
    }
    case 'digital': {
      const synth = new Synth({ oscillator: { type: 'square' } }).toDestination()
      return {
        trigger: (when, velocity, isStrong) => {
          synth.triggerAttackRelease(isStrong ? 'C5' : 'C4', '16n', when, velocity)
        },
        dispose: () => {
          synth.dispose()
        },
      }
    }
    case 'kick': {
      const synth = new MembraneSynth().toDestination()
      return {
        trigger: (when, velocity, isStrong) => {
          synth.triggerAttackRelease(isStrong ? 'C2' : 'C1', '16n', when, velocity)
        },
        dispose: () => {
          synth.dispose()
        },
      }
    }
    case 'click': {
      const synth = new NoiseSynth().toDestination()
      return {
        // NoiseSynth 无音高：triggerAttackRelease('16n', time, velocity)（§3.7）
        trigger: (when, velocity) => {
          synth.triggerAttackRelease('16n', when, velocity)
        },
        dispose: () => {
          synth.dispose()
        },
      }
    }
  }
}

// ── 真实引擎组装（Tone 接线默认件，§3.2/§3.6/§3.9）─────────────────────

const drawScheduler: DrawScheduler = {
  // UI 更新搬到最近 rAF；过期事件 >250ms 由 Tone.Draw 自行丢弃（§3.1）。
  // 视觉对齐「听感」而非「时间轴」：采样与 Draw 同在 context 时间轴上，但用户听到的
  // 是输出延迟之后的声音，Draw 时刻须叠加 outputLatency（Safari 无此 API 时为 0）。
  schedule: (callback, whenSeconds) => getDraw().schedule(callback, drawWhenSeconds(whenSeconds)),
}

/** Draw 调度时刻 = 音频时刻 + 输出延迟（getContext 每次现读，设备切换即时生效） */
export function drawWhenSeconds(whenSeconds: number): number {
  const raw = getContext().rawContext as unknown as { outputLatency?: number }
  const latency = raw.outputLatency
  return whenSeconds + (typeof latency === 'number' && Number.isFinite(latency) ? latency : 0)
}

/**
 * 组装真实引擎：钢琴预载（构造即加载，§3.6）+ LinearTimingSource（秒表锚定
 * Tone 音频时钟，时钟与音频图同源 §3.9）+ Tone.start 音频解锁 + 节拍器合成器。
 */
export async function createScorePlaybackEngine(bpm: number): Promise<PlaybackEngine> {
  const piano = await loadInstrument('piano')
  await piano.ready // 就绪才创建引擎：usePlayback 的 ready 语义即「钢琴预载完成」（§3.6）
  return new PlaybackEngine({
    bpm,
    timingSource: new LinearTimingSource(() => getContext().currentTime, bpm),
    sampler: piano.sampler,
    drawScheduler,
    ensureAudioContext: () => toneStart(),
    metronomeFactory: createMetronomeVoice,
  })
}
