/**
 * 播放数据构建（docs/audio.md §2）：OSMD 光标 → PlaybackEntry[]，乐谱时域单一事实来源。
 * 构建与 BPM 解耦（决策 A12）：条目全部存 RealValue，秒只在引擎时钟边界进入换算，
 * 加载后构建一次、变速零重建。
 * noteIndex 计数复用 NoteInteraction.occupiesPlaybackSlot —— 与命中测试同源是硬约束
 * （audio.md §2.4 / tech.md §3；任何一侧改动计数必须双侧同改 + 重跑镜像回归）。
 * 装饰音域（倚音发音/波音颤音回音展开，决策 A17）：切片子条目共享主音 noteIndex，
 * 纯展开逻辑在 ornaments.ts，本文件只做 OSMD 数据提取（OrnamentContainer/调号/音级）。
 */
import type { Cursor, Note, SourceMeasure, VoiceEntry } from 'opensheetmusicdisplay'
import type { PlaybackEntry } from '../types/playback'
import { occupiesPlaybackSlot } from '../utils/notation/NoteInteraction'
import { ornamentKindFromEnum, placeGraceNotes, realizeOrnament } from './ornaments'
import type { OrnamentKind } from './ornaments'

/** 光标步进保险上限（官方 PlaybackNoteGenerator.calculate 同款 1e6 步保险） */
const MAX_CURSOR_STEPS = 1_000_000

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** halfTone → 音名：与 Tone `Frequency(halfTone, 'midi').toNote()` 同构（升号记法，60 = 'C4'） */
export function halfToneToNoteName(halfTone: number): string {
  const pitchClass = ((halfTone % 12) + 12) % 12
  const octave = Math.floor(halfTone / 12) - 1
  return `${NOTE_NAMES[pitchClass] ?? 'C'}${octave}`
}

/**
 * OSMD `Note.halfTone` 与 MIDI 的换算差（实测补记，2026-10-18）：
 * OSMD Pitch.halfTone = 12×XML八度 + 音级 + 变化音（C4 = 48），比 MIDI 低 12
 * （源码 `halfTone = fundamental + 12 × octave + accidental`，octXmlDiff = 0）；
 * 漏加会把整首曲子降八度播放（实测小星星 C4→C3）。变化音已含在 halfTone 内。
 */
const OSMD_HALF_TONE_TO_MIDI = 12

/** 条目时长：tie 起始音取 NoteTie.Duration（延音合并），其余取 Length（audio.md §2.2-2） */
function effectiveRealValue(note: Note): number {
  const tie = note.NoteTie
  return tie !== undefined && tie !== null ? tie.Duration.RealValue : note.Length.RealValue
}

function midiNoteName(note: Note): string {
  return halfToneToNoteName(note.halfTone + OSMD_HALF_TONE_TO_MIDI)
}

/** NoteEnum 音级表（半音值）：C D E F G A B（OSMD NoteEnum 即半音数） */
const DIATONIC_LETTERS = [0, 2, 4, 5, 7, 9, 11] as const

interface OrnamentKey {
  /** 调号 fifths（>0 升号族、<0 降号族）；缺失 = 0 */
  Key?: number
  /** 被调号改变的音级（NoteEnum 半音值）列表 */
  AlteratedNotes?: number[]
}

/** 调号对某音级的变化音（半音偏移）：升号族 +1、降号族 −1；无调号信息 = 0（自然音邻） */
function keyAlterationFor(key: OrnamentKey | null | undefined, letter: number): number {
  if (key === null || key === undefined) return 0
  if (typeof key.Key !== 'number' || !Array.isArray(key.AlteratedNotes)) return 0
  return key.AlteratedNotes.includes(letter) ? (key.Key >= 0 ? 1 : -1) : 0
}

/** 调号信息来源：迭代器当前小节 getKeyInstruction(0)（单声部 staff 0）；替身可缺省 */
function activeKey(measure: SourceMeasure | undefined): OrnamentKey | null {
  const instruction = (measure as { getKeyInstruction?: (staff: number) => unknown } | undefined)
    ?.getKeyInstruction?.(0)
  return (instruction ?? null) as OrnamentKey | null
}

/**
 * 装饰音上/下邻音音名（§2.2 规则 9）：音级表 ±1 位（B↔C 进位八度），变化音取当前调号。
 * 邻音与官方 VoiceEntry.createVoiceEntriesForOrnament 同语义（getTransposedPitch ±1 +
 * key.getAlterationForPitch）。八度从 halfTone 推导（floor = sounding MIDI 八度）——
 * OSMD `Pitch.Octave` 是内部相对八度（C5 返回 2，差 3），直用会低三个八度（实测踩坑）；
 * 音级异常（微分音）或 Pitch 缺失时回落主音自身（交替退化为原音）。
 */
function ornamentNeighbors(
  note: Note,
  key: OrnamentKey | null,
): { upper: string; lower: string } {
  const base = midiNoteName(note)
  const pitch = (note as { Pitch?: { FundamentalNote?: number } | undefined }).Pitch
  const fundamental = pitch?.FundamentalNote
  const octave = Math.floor(note.halfTone / 12)
  if (typeof fundamental !== 'number' || !Number.isFinite(octave)) return { upper: base, lower: base }
  const index = DIATONIC_LETTERS.indexOf(fundamental as (typeof DIATONIC_LETTERS)[number])
  if (index === -1) return { upper: base, lower: base }
  const upIndex = (index + 1) % DIATONIC_LETTERS.length
  const downIndex = (index + DIATONIC_LETTERS.length - 1) % DIATONIC_LETTERS.length
  const upOctave = octave + (upIndex === 0 ? 1 : 0)
  const downOctave = octave - (downIndex === DIATONIC_LETTERS.length - 1 ? 1 : 0)
  const upLetter = DIATONIC_LETTERS[upIndex]!
  const downLetter = DIATONIC_LETTERS[downIndex]!
  // 标准 MIDI 公式 12×(octave+1)+音级+变化音（非 OSMD halfTone 记法，不再 +12）
  const upper = halfToneToNoteName(12 * (upOctave + 1) + upLetter + keyAlterationFor(key, upLetter))
  const lower = halfToneToNoteName(
    12 * (downOctave + 1) + downLetter + keyAlterationFor(key, downLetter),
  )
  return { upper, lower }
}

/** VoiceEntry.OrnamentContainer → 播放域装饰音种类；无容器/未知枚举 = null（原样播放） */
function ornamentKindOf(voiceEntry: VoiceEntry): OrnamentKind | null {
  const container = (
    voiceEntry as { OrnamentContainer?: { GetOrnament?: number } | undefined }
  ).OrnamentContainer
  const value = container?.GetOrnament
  return typeof value === 'number' ? ornamentKindFromEnum(value) : null
}

function lastEndRv(entries: readonly PlaybackEntry[]): number {
  const last = entries[entries.length - 1]
  return last === undefined ? 0 : last.startRv + last.durationRv
}

/**
 * 光标步进构建（audio.md §2.2）：
 * ① 空步跳过；② 延音延续音不占位不播（occupiesPlaybackSlot）；③ 条目 startRv =
 * 迭代器绝对时间戳 currentTimeStamp（官方 enrolledTimestamp 为 Fraction 同语义）——
 * 禁止从步长累计推导：tie 起始步的有效值是合并时值（§2.2-2），光标下一步却可能直达
 * 后续音符而非延续音（非邻接 tie），累计会整体漂移且不回位（marks-tie 实测，2026-10-18）；
 * ④ 休止符不产出条目但 noteIndex 占位递增；⑤ 数据终点 = 末条目末刻（§2.2-7）；
 * ⑥ 倚音（IsGrace VoiceEntry，与主音同时间戳步）发声：挤压式插在前一发音与主音之间
 * （§2.2-8），共享主音 noteIndex；⑦ 带装饰音的主音展开为切片子条目（§2.2-9），共享
 * 主音 noteIndex——noteIndex 计数不因 ⑥⑦ 变化（occupiesPlaybackSlot 硬约束不动）。
 */
export function buildPlaybackData(cursor: Cursor): PlaybackEntry[] {
  const entries: PlaybackEntry[] = []
  cursor.reset()
  let noteIndex = 0
  let pendingGraces: string[] = []
  for (let step = 0; step < MAX_CURSOR_STEPS; step += 1) {
    if (cursor.iterator.EndReached) break
    const voiceEntries = cursor.iterator.CurrentVoiceEntries
    if (voiceEntries.length > 0) {
      const startRv = cursor.iterator.currentTimeStamp.RealValue
      const stepEntries: PlaybackEntry[] = []
      let graceSpecs: PlaybackEntry[] = []
      let mainHandled = false
      for (const voiceEntry of voiceEntries) {
        if (voiceEntry.IsGrace) {
          for (const note of voiceEntry.Notes) {
            if (!note.isRest()) pendingGraces.push(midiNoteName(note))
          }
          continue
        }
        const kind = ornamentKindOf(voiceEntry)
        const key = kind === null ? null : activeKey(cursor.iterator.CurrentMeasure)
        for (const note of voiceEntry.Notes) {
          if (!occupiesPlaybackSlot(note)) continue
          const durationRv = effectiveRealValue(note)
          if (!note.isRest()) {
            let effectiveStart = startRv
            let effectiveDuration = durationRv
            if (!mainHandled && pendingGraces.length > 0) {
              // 倚音挂在本步首个发音条目上（§2.2-8）；先于装饰音展开改写主音，切片才整体一致。
              // 无处安放（主音过短）则整组丢弃。
              const placement = placeGraceNotes(
                pendingGraces.length,
                startRv,
                durationRv,
                lastEndRv(entries),
              )
              if (placement !== null) {
                effectiveStart += placement.mainShiftRv
                effectiveDuration -= placement.mainShiftRv
                const measureIndex = cursor.iterator.CurrentMeasureIndex
                graceSpecs = placement.startsRv.map((graceStartRv, i) => ({
                  startRv: graceStartRv,
                  durationRv: placement.durationRv,
                  measureIndex,
                  noteIndex,
                  noteName: pendingGraces[i]!,
                }))
              }
              pendingGraces = []
            }
            mainHandled = true
            const base: PlaybackEntry = {
              startRv: effectiveStart,
              durationRv: effectiveDuration,
              measureIndex: cursor.iterator.CurrentMeasureIndex,
              noteIndex,
              noteName: midiNoteName(note),
            }
            if (kind !== null) {
              const { upper, lower } = ornamentNeighbors(note, key)
              stepEntries.push(...graceSpecs, ...realizeOrnament(base, kind, upper, lower))
              graceSpecs = []
            } else {
              stepEntries.push(...graceSpecs, base)
              graceSpecs = []
            }
          }
          noteIndex += 1
        }
      }
      entries.push(...stepEntries)
    }
    cursor.next()
  }
  return entries
}
