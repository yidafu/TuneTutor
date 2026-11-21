import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMetronomeVoice,
  createScorePlaybackEngine,
  disposeInstruments,
  drawWhenSeconds,
  isInstrumentLoaded,
  loadInstrument,
} from '@/audio/InstrumentLoader'
import { PlaybackEngine } from '@/audio/PlaybackEngine'
import type { InstrumentType } from '@/types/audio'

/**
 * InstrumentLoader 单测（docs/audio.md §7「mock 包」层）：
 * vi.mock 'tone' 与 12 个采样包，验证缓存/单飞、ready 语义、释放与节拍器声部；
 * 真实采样加载为手动验收（样例谱过 F5–F9，tech.md §10）。
 */

interface MockTarget {
  calls: unknown[][]
  releaseAllCount: number
  disposed: number
  toDestinationCount: number
  onload: (() => void) | undefined
}

const pkgState = vi.hoisted(() => ({
  created: [] as Array<{ pkg: string; target: MockTarget }>,
}))

const toneState = vi.hoisted(() => ({
  contextCurrentTime: 123.5,
  outputLatency: 0.25 as number | undefined,
  synths: [] as Array<{ kind: string; oscType?: string; calls: unknown[][]; disposed: number }>,
}))

function instrumentPackageMock(pkg: string): { default: new (options?: { onload?: () => void }) => unknown } {
  class MockInstrument {
    calls: unknown[][] = []
    releaseAllCount = 0
    disposed = 0
    toDestinationCount = 0
    onload: (() => void) | undefined
    release = 0

    constructor(options?: { onload?: () => void }) {
      this.onload = options?.onload
      pkgState.created.push({ pkg, target: this })
    }

    toDestination(): this {
      this.toDestinationCount += 1
      return this
    }

    triggerAttackRelease(...args: unknown[]): void {
      this.calls.push(args)
    }

    releaseAll(): void {
      this.releaseAllCount += 1
    }

    dispose(): void {
      this.disposed += 1
    }
  }
  return { default: MockInstrument }
}

vi.mock('tone', () => {
  class MockSynth {
    record: { kind: string; oscType?: string; calls: unknown[][]; disposed: number }

    constructor(kind: string, oscType?: string) {
      this.record = { kind, oscType, calls: [], disposed: 0 }
      toneState.synths.push(this.record)
    }

    toDestination(): this {
      return this
    }

    triggerAttackRelease(...args: unknown[]): void {
      this.record.calls.push(args)
    }

    dispose(): void {
      this.record.disposed += 1
    }
  }
  return {
    Sampler: class MockSampler {},
    MembraneSynth: class extends MockSynth {
      constructor() {
        super('membrane')
      }
    },
    Synth: class extends MockSynth {
      constructor(options?: { oscillator?: { type?: string } }) {
        super('synth', options?.oscillator?.type)
      }
    },
    NoiseSynth: class extends MockSynth {
      constructor() {
        super('noise')
      }
    },
    getContext: () => ({
      currentTime: toneState.contextCurrentTime,
      rawContext: { outputLatency: toneState.outputLatency },
    }),
    getDraw: () => ({ schedule: (callback: () => void, when: number) => ({ callback, when }) }),
    start: async (): Promise<void> => {},
  }
})

vi.mock('tonejs-instrument-piano-mp3', () => instrumentPackageMock('piano'))
vi.mock('tonejs-instrument-saxophone-mp3', () => instrumentPackageMock('saxophone'))
vi.mock('tonejs-instrument-clarinet-mp3', () => instrumentPackageMock('clarinet'))
vi.mock('tonejs-instrument-flute-mp3', () => instrumentPackageMock('flute'))
vi.mock('tonejs-instrument-trumpet-mp3', () => instrumentPackageMock('trumpet'))
vi.mock('tonejs-instrument-french-horn-mp3', () => instrumentPackageMock('frenchHorn'))
vi.mock('tonejs-instrument-trombone-mp3', () => instrumentPackageMock('trombone'))
vi.mock('tonejs-instrument-violin-mp3', () => instrumentPackageMock('violin'))
vi.mock('tonejs-instrument-cello-mp3', () => instrumentPackageMock('cello'))
vi.mock('tonejs-instrument-guitar-acoustic-mp3', () => instrumentPackageMock('guitar'))
vi.mock('tonejs-instrument-guitar-nylon-mp3', () => instrumentPackageMock('guitarNylon'))
vi.mock('tonejs-instrument-bass-electric-mp3', () => instrumentPackageMock('bass'))

const INSTRUMENT_PACKAGES: Record<InstrumentType, string> = {
  piano: 'piano',
  saxophone: 'saxophone',
  clarinet: 'clarinet',
  flute: 'flute',
  trumpet: 'trumpet',
  frenchHorn: 'frenchHorn',
  trombone: 'trombone',
  violin: 'violin',
  cello: 'cello',
  guitar: 'guitar',
  guitarNylon: 'guitarNylon',
  bass: 'bass',
}

function createdOf(pkg: string): Array<{ pkg: string; target: MockTarget }> {
  return pkgState.created.filter((item) => item.pkg === pkg)
}

beforeEach(() => {
  disposeInstruments()
  pkgState.created.length = 0
  toneState.synths.length = 0
  toneState.outputLatency = 0.25
})

describe('drawWhenSeconds（视觉对齐听感：Draw 时刻叠加输出延迟）', () => {
  it('叠加 outputLatency；API 缺失/非法值原样返回', () => {
    expect(drawWhenSeconds(2)).toBe(2.25)
    toneState.outputLatency = undefined
    expect(drawWhenSeconds(2)).toBe(2)
    toneState.outputLatency = Number.NaN
    expect(drawWhenSeconds(2)).toBe(2)
  })
})

describe('InstrumentLoader 采样器缓存（docs/audio.md §4）', () => {
  it('同类型并发请求共享同一实例（缓存单飞）', async () => {
    const first = await loadInstrument('piano')
    const second = await loadInstrument('piano')
    expect(second).toBe(first)
    expect(second.sampler).toBe(first.sampler)
    expect(createdOf('piano')).toHaveLength(1)
  })

  it('十二种乐器各自构造对应包，sampler 视图委托到底层', async () => {
    for (const type of Object.keys(INSTRUMENT_PACKAGES) as InstrumentType[]) {
      const before = createdOf(INSTRUMENT_PACKAGES[type]).length
      const loaded = await loadInstrument(type)
      expect(loaded.type).toBe(type)
      expect(createdOf(INSTRUMENT_PACKAGES[type])).toHaveLength(before + 1)
      createdOf(INSTRUMENT_PACKAGES[type])[before]!.target.onload?.()
      await loaded.ready
      loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
      loaded.sampler.releaseAll()
      const target = createdOf(INSTRUMENT_PACKAGES[type])[before]!.target
      expect(target.calls[0]).toEqual(['C4', 1, 2, 0.7])
      expect(target.releaseAllCount).toBe(1)
    }
  })

  it('构造即接 destination（包族与 Tone 均不自动连线，漏接 = 播放全程无声）', async () => {
    await loadInstrument('piano')
    const target = createdOf('piano')[0]!.target as MockTarget & { toDestinationCount: number }
    expect(target.toDestinationCount).toBe(1)
  })

  it('ready 前 triggerAttackRelease 静默丢弃（防 Tone 对未加载 buffer 抛错打死引擎 tick）', async () => {
    const loaded = await loadInstrument('piano')
    const target = createdOf('piano')[0]!.target
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    expect(target.calls).toHaveLength(0)
    target.onload?.()
    await loaded.ready
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    expect(target.calls).toHaveLength(1)
  })

  it('统一 release 尾音优化生效（§3.4/§4 可选优化）', async () => {
    await loadInstrument('piano')
    const target = createdOf('piano')[0]!.target as MockTarget & { release: number }
    expect(target.release).toBe(0.8)
  })

  it('ready/isReady：onload 触发后就绪（triggerAttackRelease 才出声的守卫依据）', async () => {
    const loaded = await loadInstrument('flute')
    expect(loaded.isReady()).toBe(false)
    expect(isInstrumentLoaded('flute')).toBe(false)
    createdOf('flute')[0]!.target.onload?.()
    await loaded.ready
    expect(loaded.isReady()).toBe(true)
    expect(isInstrumentLoaded('flute')).toBe(true)
  })

  it('disposeInstruments 全量释放并清缓存，再次加载构造新实例', async () => {
    await loadInstrument('violin')
    const target = createdOf('violin')[0]!.target
    disposeInstruments()
    expect(target.disposed).toBe(1)
    expect(createdOf('violin')).toHaveLength(1)
    await loadInstrument('violin')
    expect(createdOf('violin')).toHaveLength(2)
  })
})

describe('createMetronomeVoice（节拍器音色，docs/audio.md §3.7）', () => {
  it('classic：MembraneSynth 强拍 C4 / 弱拍 C3', () => {
    const voice = createMetronomeVoice('classic')
    voice.trigger(10, 0.8, true)
    voice.trigger(11, 0.5, false)
    voice.dispose()
    expect(toneState.synths).toHaveLength(1)
    expect(toneState.synths[0]!.kind).toBe('membrane')
    expect(toneState.synths[0]!.calls).toEqual([
      ['C4', '16n', 10, 0.8],
      ['C3', '16n', 11, 0.5],
    ])
    expect(toneState.synths[0]!.disposed).toBe(1)
  })

  it('digital：square Synth 强 C5 / 弱 C4；kick：MembraneSynth 强 C2 / 弱 C1', () => {
    createMetronomeVoice('digital').trigger(1, 0.8, true)
    createMetronomeVoice('kick').trigger(2, 0.5, false)
    expect(toneState.synths[0]).toMatchObject({ kind: 'synth', oscType: 'square' })
    expect(toneState.synths[0]!.calls[0]).toEqual(['C5', '16n', 1, 0.8])
    expect(toneState.synths[1]).toMatchObject({ kind: 'membrane' })
    expect(toneState.synths[1]!.calls[0]).toEqual(['C1', '16n', 2, 0.5])
  })

  it('click：NoiseSynth 无音高签名 triggerAttackRelease("16n", time, velocity)', () => {
    const voice = createMetronomeVoice('click')
    voice.trigger(12, 0.6, true)
    expect(toneState.synths[0]!.kind).toBe('noise')
    expect(toneState.synths[0]!.calls[0]).toEqual(['16n', 12, 0.6])
  })
})

describe('createScorePlaybackEngine（真实接线默认件，docs/audio.md §3.2/§3.9）', () => {
  /** 引擎创建现等待钢琴 ready（usePlayback ready 语义 = 预载完成），先备好已就绪的钢琴 */
  async function prepareReadyPiano(): Promise<void> {
    const preloaded = await loadInstrument('piano')
    createdOf('piano')[0]!.target.onload?.()
    await preloaded.ready
  }

  it('构造即预载钢琴；时钟锚定注入的音频钟', async () => {
    await prepareReadyPiano()
    const engine = await createScorePlaybackEngine(90)
    expect(engine).toBeInstanceOf(PlaybackEngine)
    expect(engine.getState()).toBe('STOPPED')
    expect(createdOf('piano')).toHaveLength(1)
    expect(engine.getCurrentTimestamp()).toBe(0)
    engine.setBpm(120)
    expect(engine.getCurrentTimestamp()).toBe(0) // 变速不跳时刻
  })

  it('节拍器声部经注入工厂创建', async () => {
    await prepareReadyPiano()
    const engine = await createScorePlaybackEngine(60)
    engine.setMetronome({ enabled: true })
    expect(toneState.synths).toHaveLength(1)
    expect(toneState.synths[0]!.kind).toBe('membrane')
  })
})
