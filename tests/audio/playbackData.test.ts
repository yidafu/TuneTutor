import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Cursor, Note, VoiceEntry } from 'opensheetmusicdisplay'
import { buildPlaybackData, halfToneToNoteName } from '@/audio/playbackData'
import { dataEndRv } from '@/utils/notation/selection'

interface MockNoteSpec {
  /** undefined = 休止符 */
  halfTone?: number
  /** 写入时值（Length.RealValue） */
  lengthRv: number
  grace?: boolean
  /** 连结线角色：start 建立新 tie（tieDurationRv 为合并时值），continue 接最近一个 start */
  tie?: 'start' | 'continue'
  tieDurationRv?: number
  /** 音级/八度（Note.FundamentalNote/Octave，装饰音邻音解析用）；C4 = {0, 4} */
  pitch?: { fundamental: number; octave: number }
}

interface MockStepSpec {
  notes?: MockNoteSpec[]
  /** 多声部步骤（每项一个 VoiceEntry）；与 notes 二选一 */
  voices?: MockNoteSpec[][]
  /** 倚音 VoiceEntry（IsGrace=true，排在主音前，与主音同时间戳步，模拟真实 OSMD） */
  graceNotes?: MockNoteSpec[]
  /** 主音 VoiceEntry 的装饰音（OSMD OrnamentEnum 数值：0=trill 5=mordent 6=inverted-mordent…） */
  ornament?: number
  measureIndex?: number
}

function makeNote(spec: MockNoteSpec): Note {
  const note = {
    IsGraceNote: spec.grace === true,
    PrintObject: true,
    // halfTone 用 OSMD 记法（12×八度 + 音级，C4 = 48），与真实 OSMD 一致（buildPlaybackData 内 +12 转 MIDI）
    halfTone: spec.halfTone ?? 48,
    Length: { RealValue: spec.lengthRv },
    isRest: () => spec.halfTone === undefined,
    ...(spec.pitch === undefined
      ? {}
      : { Pitch: { FundamentalNote: spec.pitch.fundamental, Octave: spec.pitch.octave } }),
  } as unknown as Note & { __tie?: unknown }
  if (spec.tie === 'start') {
    const tie = {
      StartNote: note,
      Duration: { RealValue: spec.tieDurationRv ?? spec.lengthRv },
    }
    ;(note as { NoteTie?: unknown }).NoteTie = tie
  }
  return note
}

/** 逐步构建 OSMD 光标替身：reset→step0，next 前进，末步后 EndReached。
 * currentTimeStamp 模拟真实迭代器的绝对时间戳：每步推进 = 该步声部最大时值（步距紧邻）。
 * 倚音步进时长为 0（真实 OSMD 中倚音 Length 不推进光标），模拟为不计入 stepRv。 */
function buildMockCursor(steps: MockStepSpec[]): Cursor {
  let pendingTie: { StartNote: Note; Duration: { RealValue: number } } | null = null
  let elapsed = 0
  const built = steps.map((step) => {
    const mainVoices = (step.voices ?? [step.notes ?? []]).map((voice) =>
      voice.map((spec) => {
        const note = makeNote(spec)
        if (spec.tie === 'start') {
          pendingTie = (note as { NoteTie?: { StartNote: Note; Duration: { RealValue: number } } })
            .NoteTie!
        } else if (spec.tie === 'continue') {
          ;(note as { NoteTie?: unknown }).NoteTie = pendingTie
        }
        return note
      }),
    )
    const graceVoice = (step.graceNotes ?? []).map((spec) => makeNote(spec))
    const entries: Array<{ IsGrace: boolean; Notes: Note[]; OrnamentContainer?: unknown }> = []
    if (step.graceNotes !== undefined) entries.push({ IsGrace: true, Notes: graceVoice })
    mainVoices.forEach((notes, i) => {
      const voiceEntry: { IsGrace: boolean; Notes: Note[]; OrnamentContainer?: unknown } = {
        IsGrace: false,
        Notes: notes,
      }
      if (i === 0 && step.ornament !== undefined) {
        voiceEntry.OrnamentContainer = { GetOrnament: step.ornament }
      }
      entries.push(voiceEntry)
    })
    const stepRv = Math.max(
      0,
      ...mainVoices.map((notes) => Math.max(0, ...notes.map((n) => n.Length.RealValue))),
    )
    const timestamp = elapsed
    elapsed += stepRv
    return { voices: entries, measureIndex: step.measureIndex ?? 0, timestamp }
  })
  let index = 0
  const cursor = {
    reset: () => {
      index = 0
    },
    next: () => {
      index += 1
    },
    iterator: {
      get EndReached(): boolean {
        return index >= built.length
      },
      get CurrentVoiceEntries(): VoiceEntry[] {
        const step = built[Math.min(index, built.length - 1)]
        if (step === undefined) return []
        return step.voices as unknown as VoiceEntry[]
      },
      get CurrentMeasureIndex(): number {
        return built[Math.min(index, built.length - 1)]?.measureIndex ?? 0
      },
      get currentTimeStamp(): { RealValue: number } {
        return { RealValue: built[Math.min(index, built.length - 1)]?.timestamp ?? 0 }
      },
    },
  }
  return cursor as unknown as Cursor
}

describe('halfToneToNoteName（与 Tone Frequency.toNote 同构）', () => {
  it('60→C4、61→C#4、69→A4、21→A0、108→C8', () => {
    expect(halfToneToNoteName(60)).toBe('C4')
    expect(halfToneToNoteName(61)).toBe('C#4')
    expect(halfToneToNoteName(69)).toBe('A4')
    expect(halfToneToNoteName(70)).toBe('A#4')
    expect(halfToneToNoteName(21)).toBe('A0')
    expect(halfToneToNoteName(108)).toBe('C8')
  })
})

describe('buildPlaybackData（OSMD 光标 → 乐谱时域条目，docs/audio.md §2.2）', () => {
  it('startRv 累计步长；noteIndex 连续；measureIndex 取光标当前小节', () => {
    const cursor = buildMockCursor([
      { measureIndex: 0, notes: [{ halfTone: 48, lengthRv: 0.25 }] },
      { measureIndex: 0, notes: [{ halfTone: 50, lengthRv: 0.25 }] },
      { measureIndex: 1, notes: [{ halfTone: 52, lengthRv: 0.5 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ startRv: 0, durationRv: 0.25, measureIndex: 0, noteIndex: 0, noteName: 'C4' })
    expect(entries[1]).toMatchObject({ startRv: 0.25, durationRv: 0.25, measureIndex: 0, noteIndex: 1, noteName: 'D4' })
    expect(entries[2]).toMatchObject({ startRv: 0.5, durationRv: 0.5, measureIndex: 1, noteIndex: 2, noteName: 'E4' })
    // 数据终点 = 末条目末刻（§2.2-7：自动停止等最后一音播完）
    expect(dataEndRv(entries)).toBeCloseTo(1, 12)
  })

  it('休止符：不产出条目、noteIndex 占位递增、但计入步长（§2.2-4）', () => {
    const cursor = buildMockCursor([
      { notes: [{ halfTone: 48, lengthRv: 0.25 }] },
      { notes: [{ halfTone: undefined, lengthRv: 0.5 }] },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(2)
    expect(entries[1]).toMatchObject({ startRv: 0.75, noteIndex: 2, noteName: 'E4' })
  })

  it('连结线：延续音不占位不播，起始音合并 NoteTie.Duration；链后步长不被二次累计', () => {
    const cursor = buildMockCursor([
      // 二分音符 tie 三连（0.25×3 合并 0.75）：起始步长 = 合并值，延续步长贡献 0
      { notes: [{ halfTone: 48, lengthRv: 0.25, tie: 'start', tieDurationRv: 0.75 }] },
      { notes: [{ halfTone: 48, lengthRv: 0.25, tie: 'continue' }] },
      { notes: [{ halfTone: 48, lengthRv: 0.25, tie: 'continue' }] },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ startRv: 0, durationRv: 0.75, noteIndex: 0 })
    expect(entries[1]).toMatchObject({ startRv: 0.75, noteIndex: 1 })
  })

  it('非邻接 tie（延续音前有其他光标步）：startRv 取绝对时间戳不漂移（marks-tie 回归）', () => {
    // 复刻 marks-tie.musicxml m2–m3：tie 起始音后光标先走 E5/F5/G5，延续音才出现。
    // 旧「累计步长」模型把合并时值 0.75 当步长，后续条目整体晚 0.5 且不回位。
    const cursor = buildMockCursor([
      { notes: [{ halfTone: 50, lengthRv: 0.25, tie: 'start', tieDurationRv: 0.75 }] },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
      { notes: [{ halfTone: 53, lengthRv: 0.25 }] },
      { notes: [{ halfTone: 55, lengthRv: 0.25 }] },
      { notes: [{ halfTone: 50, lengthRv: 0.25, tie: 'continue' }] },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    // 延续音步（ts=1.0）不产出条目：5 个发音音符，起点全部踩在真实时间戳上
    expect(entries.map((entry) => entry.startRv)).toEqual([0, 0.25, 0.5, 0.75, 1.25])
    // 合并时值只进 durationRv（发音时长），不影响后续条目起点
    expect(entries[0]).toMatchObject({ durationRv: 0.75 })
  })

  it('装饰音：整体跳过（无条目、不占位、不计步长），主音不受影响', () => {
    const cursor = buildMockCursor([
      {
        notes: [
          { halfTone: 60, lengthRv: 0, grace: true },
          { halfTone: 48, lengthRv: 0.25 },
        ],
      },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ startRv: 0, noteIndex: 0, noteName: 'C4' })
    expect(entries[1]).toMatchObject({ startRv: 0.25, noteIndex: 1 })
  })

  it('倚音 VoiceEntry（IsGrace）发声：挤压在前，与主音共享 noteIndex（§2.2-8）', () => {
    const cursor = buildMockCursor([
      // 曲首无空闲：倚音挤占主音头部（主音顺延 0.0625、时长扣减，末刻不变）
      {
        graceNotes: [{ halfTone: 64, lengthRv: 0, grace: true }],
        notes: [{ halfTone: 48, lengthRv: 0.5 }],
      },
      // 休止步：不产出条目，prevEnd 停在 0.5
      { notes: [{ halfTone: undefined, lengthRv: 0.5 }] },
      // 休止后有空闲：倚音整块前移贴主音起点，主音不动（noteIndex 已被休止占位至 2）
      {
        graceNotes: [{ halfTone: 69, lengthRv: 0, grace: true }],
        notes: [{ halfTone: 52, lengthRv: 0.5 }],
      },
    ])
    const entries = buildPlaybackData(cursor)
    expect(
      entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv, entry.noteIndex]),
    ).toEqual([
      ['E5', 0, 0.0625, 0],
      ['C4', 0.0625, 0.4375, 0],
      ['A5', 0.9375, 0.0625, 2],
      ['E4', 1, 0.5, 2],
    ])
  })

  it('装饰音展开：mordent 切 3 片（主-下邻-主），共享 noteIndex 不占位（§2.2-9）', () => {
    const cursor = buildMockCursor([
      {
        ornament: 5, // Mordent
        notes: [{ halfTone: 48, lengthRv: 0.25, pitch: { fundamental: 0, octave: 4 } }],
      },
      { notes: [{ halfTone: 50, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    // C4 无调号信息：下邻音 = B3（自然音级回退）
    expect(entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv, entry.noteIndex]))
      .toEqual([
        ['C4', 0, 0.0625, 0],
        ['B3', 0.0625, 0.0625, 0],
        ['C4', 0.125, 0.125, 0],
        ['D4', 0.25, 0.25, 1],
      ])
  })

  it('装饰音 trill：8 等分主/上邻交替；后续音符 noteIndex 不受切片影响', () => {
    const cursor = buildMockCursor([
      {
        ornament: 0, // Trill
        notes: [{ halfTone: 60, lengthRv: 0.5, pitch: { fundamental: 0, octave: 5 } }],
      },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(9)
    expect(entries.map((entry) => entry.noteName)).toEqual([
      'C5', 'D5', 'C5', 'D5', 'C5', 'D5', 'C5', 'D5', 'E4',
    ])
    expect(entries[8]).toMatchObject({ startRv: 0.5, noteIndex: 1 })
  })

  it('装饰音邻音取调号：G 大调（fifths 1）下邻音 E 不带升号，基音 F# 不受影响', () => {
    // OSMD 把调号烘进 halfTone（G 大调 F4 = 54），邻音变化音由 CurrentMeasure 调号解析
    const cursor = buildMockCursor([
      {
        ornament: 5, // Mordent（下邻音）
        notes: [{ halfTone: 54, lengthRv: 0.25, pitch: { fundamental: 5, octave: 4 } }],
      },
    ])
    const anyCursor = cursor as unknown as {
      iterator: { CurrentMeasure?: unknown }
    }
    anyCursor.iterator.CurrentMeasure = {
      getKeyInstruction: () => ({ Key: 1, AlteratedNotes: [5] }),
    }
    const entries = buildPlaybackData(cursor)
    // F#4 的下邻音 = E4（调号不含 E，自然音）
    expect(entries.map((entry) => entry.noteName)).toEqual(['F#4', 'E4', 'F#4'])
  })

  it('多声部：步长取该步所有声部最大有效 RealValue（§2.2-3）', () => {
    const cursor = buildMockCursor([
      {
        voices: [
          [{ halfTone: 48, lengthRv: 0.5 }],
          [
            { halfTone: 55, lengthRv: 0.25 },
            { halfTone: 57, lengthRv: 0.25 },
          ],
        ],
      },
      { notes: [{ halfTone: 52, lengthRv: 0.25 }] },
    ])
    const entries = buildPlaybackData(cursor)
    expect(entries).toHaveLength(4)
    expect(entries[3]).toMatchObject({ startRv: 0.5, noteIndex: 3 })
  })

  it('同一份构建与 BPM 无关（决策 A12）：条目只含 RealValue 域字段', () => {
    const cursor = buildMockCursor([{ notes: [{ halfTone: 48, lengthRv: 0.375 }] }])
    const entries = buildPlaybackData(cursor)
    expect(entries).toEqual([
      { startRv: 0, durationRv: 0.375, measureIndex: 0, noteIndex: 0, noteName: 'C4' },
    ])
  })

  it('空谱：无条目', () => {
    expect(buildPlaybackData(buildMockCursor([]))).toEqual([])
  })
})

describe('buildPlaybackData × 真实 OSMD 光标（marks-tie 漂移回归，jsdom 加载不渲染）', () => {
  /** 真实迭代器按 Cursor 协议包装（Cursor = iterator + 视觉层，数据构建只碰前者） */
  async function loadRealCursor(fixture: string): Promise<Cursor> {
    const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
    const container = document.createElement('div')
    const osmd = new OpenSheetMusicDisplay(container, { autoResize: false, backend: 'svg' })
    const xml = readFileSync(path.resolve(process.cwd(), 'musicxml', fixture), 'utf-8')
    await osmd.load(xml)
    const manager = osmd.Sheet.MusicPartManager
    let iterator = manager.getIterator()
    return {
      reset: () => {
        iterator = manager.getIterator()
      },
      next: () => iterator.moveToNext(),
      get iterator() {
        return iterator
      },
    } as unknown as Cursor
  }

  it('跨小节 tie 链后续音符 startRv = 光标绝对时间戳（旧累计模型给 1.75/2.0/2.25…）', async () => {
    const entries = buildPlaybackData(await loadRealCursor('marks-tie.musicxml'))
    expect(
      entries.map((entry) => [entry.startRv, entry.durationRv, entry.noteIndex]),
    ).toEqual([
      [0, 1, 0], // m1 C5 二分 tie 对：合并 1.0，延续音不占位
      [1, 0.75, 1], // m2 D5 三连链起始：合并 0.75
      [1.25, 0.25, 2], // m2 E5 —— 漂移回归点：旧模型给 1.75
      [1.5, 0.25, 3],
      [1.75, 0.25, 4],
      [2.25, 0.25, 5], // m3 E5（m3 D5 是链中段，不占位）
      [2.5, 0.25, 6],
      [2.75, 0.25, 7],
    ])
  })

  it('marks-grace：倚音发声（挤压式），共享主音 noteIndex（§2.2-8 回归）', async () => {
    const entries = buildPlaybackData(await loadRealCursor('marks-grace.musicxml'))
    expect(
      entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv, entry.noteIndex]),
    ).toEqual([
      // 曲首无空闲：倚音 E5 挤占主音头部，主音 C5 顺延
      ['E5', 0, 0.0625, 0],
      ['C5', 0.0625, 0.4375, 0],
      ['F5', 0.5, 0.25, 1],
      ['G5', 0.75, 0.25, 2],
      // m1：前条目紧贴，倚音 A5 挤占主音 B5 头部
      ['A5', 1, 0.0625, 3],
      ['B5', 1.0625, 0.4375, 3],
      ['C6', 1.5, 0.5, 4],
      // m2 双倚音 D5/E5：前条目（C6）紧贴主音，整块挤占主音 C5 头部（总时值钳到主音一半）
      ['D5', 2, 0.0625, 5],
      ['E5', 2.0625, 0.0625, 5],
      ['C5', 2.125, 0.125, 5],
      // m3：双休止占位（idx 6/7）后留出 0.625 空闲，倚音 G5 整块前移，主音 A5 不动
      ['G5', 2.9375, 0.0625, 8],
      ['A5', 3, 0.5, 8],
    ])
  })

  it('marks-mordent：波音展开为 主-下邻-主 三片（C 大调自然邻音，§2.2-9 回归）', async () => {
    const entries = buildPlaybackData(await loadRealCursor('marks-mordent.musicxml'))
    expect(
      entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv, entry.noteIndex]),
    ).toEqual([
      ['C5', 0, 0.0625, 0],
      ['B4', 0.0625, 0.0625, 0],
      ['C5', 0.125, 0.125, 0],
      ['D5', 0.25, 0.0625, 1],
      ['E5', 0.3125, 0.0625, 1],
      ['D5', 0.375, 0.125, 1],
      ['E5', 0.5, 0.5, 2],
      ['F5', 1, 0.0625, 3],
      ['E5', 1.0625, 0.0625, 3],
      ['F5', 1.125, 0.125, 3],
      ['G5', 1.25, 0.75, 4],
    ])
  })

  it('marks-trill：颤音 8 等分主/上邻交替，后续音符照常（§2.2-9 回归）', async () => {
    const entries = buildPlaybackData(await loadRealCursor('marks-trill.musicxml'))
    expect(
      entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv, entry.noteIndex]),
    ).toEqual([
      ['C5', 0, 0.0625, 0],
      ['D5', 0.0625, 0.0625, 0],
      ['C5', 0.125, 0.0625, 0],
      ['D5', 0.1875, 0.0625, 0],
      ['C5', 0.25, 0.0625, 0],
      ['D5', 0.3125, 0.0625, 0],
      ['C5', 0.375, 0.0625, 0],
      ['D5', 0.4375, 0.0625, 0],
      // 单独 wavy-line（无 trill-mark）OSMD 不产 OrnamentContainer：D5 原样播放
      ['D5', 0.5, 0.5, 1],
      ['E5', 1, 0.25, 2],
      // m1 第二个 trill-mark：F5 四分音符颤音 8×(1/32)
      ['F5', 1.25, 0.03125, 3],
      ['G5', 1.28125, 0.03125, 3],
      ['F5', 1.3125, 0.03125, 3],
      ['G5', 1.34375, 0.03125, 3],
      ['F5', 1.375, 0.03125, 3],
      ['G5', 1.40625, 0.03125, 3],
      ['F5', 1.4375, 0.03125, 3],
      ['G5', 1.46875, 0.03125, 3],
      ['G5', 1.5, 0.5, 4],
    ])
  })
})
