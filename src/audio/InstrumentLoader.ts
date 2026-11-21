/**
 * Tone.js 边界层（docs/audio.md §4 + §3.7 节拍器音色 + §3.2 接线默认件）：
 * 12 种 tonejs-instrument 采样器加载与缓存（决策 A6：不用 minify，全量采样静态打包 +
 * PWA 缓存；同类型并发请求共享同一实例）、4 种节拍器合成器声部、真实引擎组装
 * （LinearTimingSource 锚定 Tone 音频时钟 + Draw + Tone.start + 预载钢琴）。
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

import PianoMp3 from 'tonejs-instrument-piano-mp3'
import SaxophoneMp3 from 'tonejs-instrument-saxophone-mp3'
import ClarinetMp3 from 'tonejs-instrument-clarinet-mp3'
import FluteMp3 from 'tonejs-instrument-flute-mp3'
import TrumpetMp3 from 'tonejs-instrument-trumpet-mp3'
import FrenchHornMp3 from 'tonejs-instrument-french-horn-mp3'
import TromboneMp3 from 'tonejs-instrument-trombone-mp3'
import ViolinMp3 from 'tonejs-instrument-violin-mp3'
import CelloMp3 from 'tonejs-instrument-cello-mp3'
import GuitarAcousticMp3 from 'tonejs-instrument-guitar-acoustic-mp3'
import GuitarNylonMp3 from 'tonejs-instrument-guitar-nylon-mp3'
import BassElectricMp3 from 'tonejs-instrument-bass-electric-mp3'

type InstrumentConstructor = new (options?: { onload?: () => void }) => Sampler

const INSTRUMENT_CONSTRUCTORS: Record<InstrumentType, InstrumentConstructor> = {
  piano: PianoMp3,
  saxophone: SaxophoneMp3,
  clarinet: ClarinetMp3,
  flute: FluteMp3,
  trumpet: TrumpetMp3,
  frenchHorn: FrenchHornMp3,
  trombone: TromboneMp3,
  violin: ViolinMp3,
  cello: CelloMp3,
  guitar: GuitarAcousticMp3,
  guitarNylon: GuitarNylonMp3,
  bass: BassElectricMp3,
}

/** 已加载音色：sampler 为引擎可注入视图（已接 destination），ready 前 triggerAttackRelease 静默丢弃 */
export interface LoadedInstrument {
  readonly type: InstrumentType
  readonly sampler: PlaybackSampler
  readonly ready: Promise<void>
  isReady(): boolean
  /** 释放底层采样器并移出缓存（disposeInstruments / 单个卸载用） */
  dispose(): void
}

const instrumentCache = new Map<InstrumentType, LoadedInstrument>()

function createLoadedInstrument(type: InstrumentType): LoadedInstrument {
  const Constructor = INSTRUMENT_CONSTRUCTORS[type]!
  let readySettled = false
  let resolveReady!: () => void
  const ready = new Promise<void>((resolve) => {
    resolveReady = () => {
      readySettled = true
      resolve()
    }
  })
  // 包族只 extends Sampler 不接输出，Tone 节点也不自动连 destination：连接由本层负责
  const toneSampler = new Constructor({ onload: resolveReady }).toDestination()
  // 统一 release 改善尾音、收紧空拍开头渗音（audio.md §3.4 已知瑕疵 / §4 可选优化）
  toneSampler.release = 0.8
  const loaded: LoadedInstrument = {
    type,
    sampler: {
      triggerAttackRelease: (note, durationSeconds, whenSeconds, velocity) => {
        // ready 前静默丢弃：Tone 对未加载 buffer 抛「No available buffers for note」，
        // 异常发生在引擎 tick 内会打死自调度循环（§3.1 单飞纪律）
        if (!readySettled) return
        toneSampler.triggerAttackRelease(note, durationSeconds, whenSeconds, velocity)
      },
      releaseAll: () => {
        toneSampler.releaseAll()
      },
    },
    ready,
    isReady: () => readySettled,
    dispose: () => {
      toneSampler.dispose()
      instrumentCache.delete(type)
    },
  }
  return loaded
}

/** 缓存获取/加载：构造是同步的（缓冲在内部异步取），并发请求经缓存天然单飞（§4） */
export function loadInstrument(type: InstrumentType): Promise<LoadedInstrument> {
  const cached = instrumentCache.get(type)
  if (cached !== undefined) return Promise.resolve(cached)
  const loaded = createLoadedInstrument(type)
  instrumentCache.set(type, loaded)
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
