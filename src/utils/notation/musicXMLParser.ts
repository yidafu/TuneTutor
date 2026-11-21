import type { Measure as IoMeasure, MeasureAttributes, NoteEntry, Score } from 'musicxml-io'

import type { Measure, Note, ParsedScore, Transposition } from '../../types/notation'

/**
 * musicxml-io Score → ParsedScore 映射（docs/musicxml.md §2/§4）。
 * 只取 parts[0]（决策 M3，单一练习主奏）；逐音符事实、tie 不合并（M6）；
 * 标记域 capture-only 扁平标签（M8）；divisions 逐小节有效值（M4）；
 * realValue = duration ÷ 有效 divisions ÷ 4，是时值唯一权威（M5）。
 */

/** noteType → 显示标签；超出枚举（maxima/long/breve 等）反推不中 → "x" */
const NOTE_TYPE_LABELS: Record<string, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
  '64th': '64',
  '128th': '128',
  '256th': '256',
  '512th': '512',
  '1024th': '1024',
}

/** fifths −7…7 → 大调名（index = fifths + 7） */
const FIFTHS_MAJOR = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const
/** fifths −7…7 → 关系小调名（mode=minor 时使用） */
const FIFTHS_MINOR = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'] as const

/** 样例谱普遍缺失 <sound tempo>，兜底 60 是必须路径（spike §13-V5） */
export const FALLBACK_TEMPO = 60

export function fifthsToKeySignature(fifths: number, mode?: string): string {
  const index = Math.min(14, Math.max(0, fifths + 7))
  return mode === 'minor' || mode === 'aeolian'
    ? `${FIFTHS_MINOR[index]} minor`
    : `${FIFTHS_MAJOR[index]} major`
}

function accidentalFromAlter(alter: number | undefined): string | undefined {
  if (alter === undefined || alter === 0) return undefined
  return alter > 0 ? '#'.repeat(Math.round(alter)) : 'b'.repeat(Math.round(-alter))
}

function durationLabel(noteType: string | undefined, dots: number): string {
  const base = noteType === undefined ? undefined : NOTE_TYPE_LABELS[noteType]
  return base === undefined ? 'x' : base + '.'.repeat(dots)
}

/** 时值换算唯一公式；divisions 缺失/非法时返回 0（防御，不假设全曲常量，M4） */
function noteRealValue(duration: number, divisions: number | undefined): number {
  if (divisions === undefined || divisions <= 0) return 0
  return duration / divisions / 4
}

/** 音符级 notations → markings 扁平标签（capture-only，M8；文法见 docs/musicxml.md §2） */
function markingsFromNotations(note: NoteEntry): string[] | undefined {
  const notations = note.notations
  if (notations === undefined || notations.length === 0) return undefined
  const out: string[] = []
  for (const notation of notations) {
    switch (notation.type) {
      case 'ornament':
        out.push(`ornament:${notation.ornament}`)
        break
      case 'articulation':
        out.push(`articulation:${notation.articulation}`)
        break
      case 'technical':
        out.push(`technical:${notation.technical}`)
        break
      case 'slur':
        out.push(`slur:${notation.slurType}#${notation.number ?? 1}`)
        break
      case 'dynamics':
        for (const value of notation.dynamics) out.push(`dynamics:${value}`)
        break
      case 'fermata':
        out.push('fermata')
        break
      case 'arpeggiate':
        out.push('arpeggiate')
        break
      case 'glissando':
        out.push(`glissando:${notation.glissandoType}#${notation.number ?? 1}`)
        break
      case 'slide':
        out.push(`slide:${notation.slideType}#${notation.number ?? 1}`)
        break
      case 'other-notation':
        out.push(`notation:${notation.name}`)
        break
      // tied/tuplet 由 Note.tie / Note.tuplet 字段承载，不入 markings（docs/musicxml.md §4.1/§4.4）
    }
  }
  return out.length > 0 ? out : undefined
}

function pitchOf(entry: NoteEntry): { pitch: string; octave: number; accidentals?: string } {
  if (entry.rest !== undefined) return { pitch: 'rest', octave: 0 }
  if (entry.unpitched !== undefined) {
    // 打击乐谱：displayStep/displayOctave 拼接（docs/musicxml.md §4.8）
    return {
      pitch: `${entry.unpitched.displayStep ?? 'C'}${entry.unpitched.displayOctave ?? 4}`,
      octave: entry.unpitched.displayOctave ?? 4,
    }
  }
  const pitch = entry.pitch
  if (pitch === undefined) return { pitch: 'rest', octave: 0 }
  return {
    pitch: `${pitch.step}${pitch.octave}`,
    octave: pitch.octave,
    accidentals: accidentalFromAlter(pitch.alter),
  }
}

function mapNote(entry: NoteEntry, effectiveDivisions: number | undefined): Note {
  const { pitch, octave, accidentals } = pitchOf(entry)
  const isGrace = entry.grace !== undefined
  const note: Note = {
    pitch,
    duration: durationLabel(entry.noteType, entry.dots ?? 0),
    realValue: isGrace ? 0 : noteRealValue(entry.duration, effectiveDivisions),
    isRest: entry.rest !== undefined,
    dots: entry.dots ?? 0,
    octave,
    voice: entry.voice,
    ...(accidentals !== undefined ? { accidentals } : {}),
    ...(entry.staff !== undefined ? { staff: entry.staff } : {}),
    ...(entry.noteType !== undefined ? { type: entry.noteType } : {}),
    ...(entry.chord === true ? { isChord: true } : {}),
    ...(isGrace ? { isGrace: true, graceSlash: entry.grace?.slash === true } : {}),
    ...(entry.cue === true ? { isCue: true } : {}),
  }
  const tieType = tieTypeOf(entry)
  if (tieType !== undefined) note.tie = tieType
  if (entry.timeModification !== undefined) {
    note.tuplet = { actualNotes: entry.timeModification.actualNotes, normalNotes: entry.timeModification.normalNotes }
  }
  let markings = markingsFromNotations(entry)
  if (entry.unpitched !== undefined) markings = [...(markings ?? []), 'unpitched']
  if (markings !== undefined) note.markings = markings
  return note
}

/**
 * tie 解析（docs/musicxml.md §4.1，以 note/tie 为准）：
 * io 0.2.11 不产出 continue——stop+start 同现于 ties 时即「既止又起」，推导为 'continue'。
 */
function tieTypeOf(entry: NoteEntry): Note['tie'] {
  const ties = entry.ties
  if (ties !== undefined && ties.length >= 2) return 'continue'
  return entry.tie?.type
}

function multipleRestOf(attributes: MeasureAttributes | undefined): number | undefined {
  return attributes?.measureStyle?.find((style) => style.multipleRest !== undefined)?.multipleRest
}

/** attributes/transpose → 契约形状（io 产出 transpose 与 transposes[] 双形态，取首个） */
function transpositionOf(attributes: MeasureAttributes): Transposition | undefined {
  const declared = attributes.transpose ?? attributes.transposes?.[0]
  if (declared === undefined) return undefined
  return {
    diatonic: declared.diatonic,
    chromatic: declared.chromatic,
    ...(declared.octaveChange !== undefined ? { octaveChange: declared.octaveChange } : {}),
  }
}

/** 解析单小节：按 entries 顺序应用属性变更（divisions/time/key 覆写或继承，M4），direction dynamics 挂到其后第一条 note（§4.7） */
function convertMeasure(ioMeasure: IoMeasure, index: number, state: {
  divisions?: number
  time?: string
  key?: string
  tempo?: number
  transpose?: Transposition
  /** 顶层契约取首个声明（docs/musicxml.md §2：首个 attributes.time / 首小节有效 divisions / 首调号） */
  firsts: { divisions?: number; time?: string; key?: string }
}): Measure {
  const timeAtStart = state.time
  const keyAtStart = state.key
  let declaredDivisions: number | undefined
  let declaredTranspose: Transposition | undefined
  let pendingDynamics: string[] = []
  const notes: Note[] = []

  function applyAttributes(attributes: MeasureAttributes): void {
    if (attributes.divisions !== undefined) {
      state.firsts.divisions ??= attributes.divisions
      state.divisions = attributes.divisions
      declaredDivisions = attributes.divisions
    }
    if (attributes.time !== undefined) {
      state.firsts.time ??= `${attributes.time.beats}/${attributes.time.beatType}`
      state.time = `${attributes.time.beats}/${attributes.time.beatType}`
    }
    if (attributes.key !== undefined) {
      const key = fifthsToKeySignature(attributes.key.fifths, attributes.key.mode)
      state.firsts.key ??= key
      state.key = key
    }
    const transpose = transpositionOf(attributes)
    if (transpose !== undefined) {
      state.transpose = transpose
      declaredTranspose = transpose
    }
  }

  if (ioMeasure.attributes !== undefined) applyAttributes(ioMeasure.attributes)

  for (const entry of ioMeasure.entries) {
    if (entry.type === 'attributes') {
      applyAttributes(entry.attributes)
    } else if (entry.type === 'sound') {
      if (state.tempo === undefined && entry.tempo !== undefined) state.tempo = entry.tempo
    } else if (entry.type === 'direction') {
      if (state.tempo === undefined && entry.sound?.tempo !== undefined) state.tempo = entry.sound.tempo
      for (const directionType of entry.directionTypes) {
        if (directionType.kind === 'dynamics') pendingDynamics.push(`dynamics:${directionType.value}`)
      }
    } else if (entry.type === 'note') {
      const note = mapNote(entry, state.divisions)
      if (pendingDynamics.length > 0) {
        note.markings = [...(note.markings ?? []), ...pendingDynamics]
        pendingDynamics = []
      }
      notes.push(note)
    }
    // backup/forward 是排版游标、harmony/figured-bass 不入契约：跳过不产出 Note（docs/musicxml.md §4.3）
  }

  return {
    index,
    notes,
    ...(state.time !== undefined && state.time !== timeAtStart ? { timeSignature: state.time } : {}),
    ...(state.key !== undefined && state.key !== keyAtStart ? { keySignature: state.key } : {}),
    ...(declaredDivisions !== undefined ? { divisions: declaredDivisions } : {}),
    ...(declaredTranspose !== undefined ? { transpose: declaredTranspose } : {}),
    ...(multipleRestOf(ioMeasure.attributes) !== undefined
      ? { multipleRest: multipleRestOf(ioMeasure.attributes) }
      : {}),
  }
}

export function scoreToParsedScore(score: Score): ParsedScore {
  const metadata = score.metadata
  const part = score.parts[0]
  const state: { divisions?: number; time?: string; key?: string; tempo?: number; firsts: { divisions?: number; time?: string; key?: string } } = { firsts: {} }
  const measures = part.measures.map((ioMeasure, index) => convertMeasure(ioMeasure, index, state))
  const tempo = state.tempo ?? FALLBACK_TEMPO

  return {
    title: metadata.workTitle ?? metadata.movementTitle ?? '',
    ...(metadata.creators?.find((creator) => creator.type === 'composer')?.value !== undefined
      ? { composer: metadata.creators.find((creator) => creator.type === 'composer')?.value }
      : {}),
    measures,
    tempo,
    timeSignature: state.firsts.time ?? '4/4',
    ...(state.firsts.key !== undefined ? { keySignature: state.firsts.key } : {}),
    ...(state.firsts.divisions !== undefined
      ? { divisions: state.firsts.divisions }
      : { divisions: 1 }),
  }
}

/**
 * 逐小节有效移调半音表（记谱 → 实际发声，半音 = chromatic + 12×octaveChange）。
 * 声明覆写并向前继承（divisions 的 M4 同款继承规则）；曲首缺省 0（C 调乐器谱原样播）。
 * 播放域唯一消费点 = buildPlaybackData 的 transposeByMeasure（docs/audio.md §2.2-5）——
 * ParsedScore 仍不承载音符序列/索引（tech.md D1），此处只映射小节号 → 半音量。
 */
export function transposeSemitonesByMeasure(parsedScore: ParsedScore): number[] {
  let semitones = 0
  return parsedScore.measures.map((measure) => {
    const declared = measure.transpose
    if (declared !== undefined) semitones = declared.chromatic + 12 * (declared.octaveChange ?? 0)
    return semitones
  })
}
