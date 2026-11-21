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
import { SAMPLE_SOURCES } from '@/audio/sampleSources.generated'
import type { InstrumentType } from '@/types/audio'

/**
 * InstrumentLoader 单测（docs/audio.md §7「mock 包」层）：
 * vi.mock 'tone'，验证 CDN 优先 + 同源兜底的两段构造（决策 A20）、缓存/单飞、
 * ready 语义、释放与节拍器声部；真实采样加载为手动验收（样例谱过 F5–F9，tech.md §10）。
 */

interface MockSampler {
  urls: Record<string, string>
  baseUrl: string
  onload: (() => void) | undefined
  onerror: (() => void) | undefined
  calls: unknown[][]
  releaseAllCount: number
  disposed: number
  toDestinationCount: number
  release: number
}

const samplerState = vi.hoisted(() => ({
  created: [] as Array<{ target: MockSampler }>,
}))

const toneState = vi.hoisted(() => ({
  contextCurrentTime: 123.5,
  outputLatency: 0.25 as number | undefined,
  synths: [] as Array<{ kind: string; oscType?: string; calls: unknown[][]; disposed: number }>,
}))

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
  class MockSampler {
    urls: Record<string, string>
    baseUrl: string
    onload: (() => void) | undefined
    onerror: (() => void) | undefined
    calls: unknown[][] = []
    releaseAllCount = 0
    disposed = 0
    toDestinationCount = 0
    release = 0

    constructor(options?: {
      urls?: Record<string, string>
      baseUrl?: string
      onload?: () => void
      onerror?: () => void
    }) {
      this.urls = options?.urls ?? {}
      this.baseUrl = options?.baseUrl ?? ''
      this.onload = options?.onload
      this.onerror = options?.onerror
      samplerState.created.push({ target: this })
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
  return {
    Sampler: MockSampler,
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

const INSTRUMENT_TYPES = Object.keys(SAMPLE_SOURCES) as InstrumentType[]

/** 某乐器的构造尝试（按 cdnBase / bundledUrls 值归属，与构造顺序一致） */
function attemptsOf(type: InstrumentType): MockSampler[] {
  const source = SAMPLE_SOURCES[type]
  const bundledValues = new Set(Object.values(source.bundledUrls))
  return samplerState.created
    .map((item) => item.target)
    .filter((s) => s.baseUrl === source.cdnBase || (s.baseUrl === '' && Object.values(s.urls).every((v) => bundledValues.has(v))))
}

beforeEach(() => {
  disposeInstruments()
  samplerState.created.length = 0
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

describe('InstrumentLoader 两段构造（决策 A20：CDN 优先 + 同源兜底）', () => {
  it('首次构造即 CDN 尝试：urls 为音符键→文件名，baseUrl 为 jsdelivr 包@版本', async () => {
    const loaded = await loadInstrument('piano')
    expect(loaded.type).toBe('piano')
    const attempts = attemptsOf('piano')
    expect(attempts).toHaveLength(1)
    const source = SAMPLE_SOURCES.piano
    expect(attempts[0]!.baseUrl).toBe(source.cdnBase)
    expect(attempts[0]!.baseUrl).toContain('https://cdn.jsdelivr.net/npm/tonejs-instrument-piano-mp3@')
    expect(attempts[0]!.baseUrl).toContain(`@${source.version}`)
    expect(attempts[0]!.urls).toEqual(source.cdnUrls)
    // 音符键即触发音名：As1 → A#1（Tone 以音名取 buffer）
    expect(attempts[0]!.urls['A#1']).toMatch(/\.mp3$/)
    expect(attempts[0]!.urls['C3']).toMatch(/\.mp3$/)
  })

  it('CDN onerror → 释放 CDN 尝试并换同源打包采样（urls 为打包资产 URL，baseUrl 空）', async () => {
    const loaded = await loadInstrument('piano')
    const [cdn] = attemptsOf('piano')
    cdn!.onerror?.()
    const attempts = attemptsOf('piano')
    expect(attempts).toHaveLength(2)
    expect(cdn!.disposed).toBe(1)
    const bundled = attempts[1]!
    expect(bundled.baseUrl).toBe('')
    expect(bundled.urls).toEqual(SAMPLE_SOURCES.piano.bundledUrls)
    // 打包资产 URL 是构建产物绝对路径，不是 CDN 文件名
    expect(bundled.urls['A#1']).not.toBe('As1.mp3')
    void loaded
  })

  it('兜底 onload 后就绪；trigger/releaseAll 委托到当前（兜底）实例', async () => {
    const loaded = await loadInstrument('piano')
    attemptsOf('piano')[0]!.onerror?.()
    const bundled = attemptsOf('piano')[1]!
    bundled.onload?.()
    await loaded.ready
    expect(loaded.isReady()).toBe(true)
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    loaded.sampler.releaseAll()
    expect(bundled.calls[0]).toEqual(['C4', 1, 2, 0.7])
    expect(bundled.releaseAllCount).toBe(1)
    expect(attemptsOf('piano')[0]!.calls).toHaveLength(0)
  })

  it('CDN 的晚到 onload（换源后）不误置就绪；后续 stale onerror 也不再生效', async () => {
    const loaded = await loadInstrument('piano')
    const cdn = attemptsOf('piano')[0]!
    cdn.onerror?.()
    // 兜底已接管：CDN 剩余 buffer 的晚到 onload / 重复 onerror 都必须被无视
    cdn.onload?.()
    await Promise.resolve()
    expect(loaded.isReady()).toBe(false)
    expect(loaded.hasError()).toBe(false)
    cdn.onerror?.()
    expect(attemptsOf('piano')).toHaveLength(2)
    // 兜底 onload 才真正就绪
    attemptsOf('piano')[1]!.onload?.()
    await loaded.ready
    expect(loaded.isReady()).toBe(true)
  })

  it('onerror 双失败 → ready reject + hasError：视图调用依旧丢弃/不触底层（UI 加载失败态的依据）', async () => {
    const loaded = await loadInstrument('piano')
    expect(loaded.hasError()).toBe(false)
    expect(loaded.isReady()).toBe(false)
    attemptsOf('piano')[0]!.onerror?.() // CDN 失败 → 兜底
    attemptsOf('piano')[1]!.onerror?.() // 兜底也失败 → reject
    expect(loaded.hasError()).toBe(true)
    expect(loaded.isReady()).toBe(false)
    await expect(loaded.ready).rejects.toThrow('failed to load')
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    expect(attemptsOf('piano')[1]!.calls).toHaveLength(0)
    loaded.sampler.releaseAll()
    expect(attemptsOf('piano')[1]!.releaseAllCount).toBe(0)
  })

  it('每段尝试统一 release 尾音并接 destination（§3.4/§4 可选优化 + 漏接 = 无声）', async () => {
    await loadInstrument('piano')
    const [cdn] = attemptsOf('piano')
    expect(cdn!.release).toBe(0.8)
    expect(cdn!.toDestinationCount).toBe(1)
    cdn!.onerror?.()
    const bundled = attemptsOf('piano')[1]!
    expect(bundled.release).toBe(0.8)
    expect(bundled.toDestinationCount).toBe(1)
  })
})

describe('InstrumentLoader 采样器缓存（docs/audio.md §4）', () => {
  it('同类型并发请求共享同一实例（缓存单飞）', async () => {
    const first = await loadInstrument('piano')
    const second = await loadInstrument('piano')
    expect(second).toBe(first)
    expect(second.sampler).toBe(first.sampler)
    expect(attemptsOf('piano')).toHaveLength(1)
  })

  it('十二种乐器各自按生成清单构造 CDN 尝试', async () => {
    for (const type of INSTRUMENT_TYPES) {
      const before = attemptsOf(type).length
      const loaded = await loadInstrument(type)
      expect(loaded.type).toBe(type)
      const attempts = attemptsOf(type)
      expect(attempts).toHaveLength(before + 1)
      expect(attempts[before]!.baseUrl).toBe(SAMPLE_SOURCES[type].cdnBase)
      expect(attempts[before]!.urls).toEqual(SAMPLE_SOURCES[type].cdnUrls)
      attempts[before]!.onload?.()
      await loaded.ready
      loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
      loaded.sampler.releaseAll()
      expect(attempts[before]!.calls[0]).toEqual(['C4', 1, 2, 0.7])
      expect(attempts[before]!.releaseAllCount).toBe(1)
    }
  })

  it('ready 前 triggerAttackRelease 静默丢弃（防 Tone 对未加载 buffer 抛错打死引擎 tick）', async () => {
    const loaded = await loadInstrument('piano')
    const cdn = attemptsOf('piano')[0]!
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    expect(cdn.calls).toHaveLength(0)
    cdn.onload?.()
    await loaded.ready
    loaded.sampler.triggerAttackRelease('C4', 1, 2, 0.7)
    expect(cdn.calls).toHaveLength(1)
  })

  it('ready/isReady：onload 触发后就绪（triggerAttackRelease 才出声的守卫依据）', async () => {
    const loaded = await loadInstrument('flute')
    expect(loaded.isReady()).toBe(false)
    expect(isInstrumentLoaded('flute')).toBe(false)
    attemptsOf('flute')[0]!.onload?.()
    await loaded.ready
    expect(loaded.isReady()).toBe(true)
    expect(isInstrumentLoaded('flute')).toBe(true)
  })

  it('失败条目不缓存复用：再次加载构造新尝试对并释放旧实例', async () => {
    const failed = await loadInstrument('cello')
    attemptsOf('cello')[0]!.onerror?.()
    attemptsOf('cello')[1]!.onerror?.()
    await expect(failed.ready).rejects.toThrow()

    const fresh = await loadInstrument('cello')
    expect(fresh).not.toBe(failed)
    // 失败条目 dispose 释放的是其当前尝试（兜底实例）；CDN 尝试已在换源时释放
    expect(attemptsOf('cello')[1]!.disposed).toBe(1)
    // 重载构造新的 CDN 尝试（兜底按需才造）
    expect(attemptsOf('cello')).toHaveLength(3)

    attemptsOf('cello')[2]!.onload?.()
    await fresh.ready
    fresh.sampler.triggerAttackRelease('C3', 0.5, 0, 0.8)
    expect(attemptsOf('cello')[2]!.calls).toHaveLength(1)
  })

  it('ready 前 releaseAll 为 no-op（无已发声声部；也避免对 disposed 节点抛错）', async () => {
    const loaded = await loadInstrument('piano')
    const cdn = attemptsOf('piano')[0]!
    loaded.sampler.releaseAll()
    expect(cdn.releaseAllCount).toBe(0)
    cdn.onload?.()
    await loaded.ready
    loaded.sampler.releaseAll()
    expect(cdn.releaseAllCount).toBe(1)
  })

  it('disposeInstruments 全量释放并清缓存，再次加载构造新实例', async () => {
    await loadInstrument('violin')
    const cdn = attemptsOf('violin')[0]!
    disposeInstruments()
    expect(cdn.disposed).toBe(1)
    expect(attemptsOf('violin')).toHaveLength(1)
    await loadInstrument('violin')
    expect(attemptsOf('violin')).toHaveLength(2)
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
    attemptsOf('piano')[0]!.onload?.()
    await preloaded.ready
  }

  it('构造即预载钢琴；时钟锚定注入的音频钟', async () => {
    await prepareReadyPiano()
    const engine = await createScorePlaybackEngine(90)
    expect(engine).toBeInstanceOf(PlaybackEngine)
    expect(engine.getState()).toBe('STOPPED')
    expect(attemptsOf('piano')).toHaveLength(1)
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
