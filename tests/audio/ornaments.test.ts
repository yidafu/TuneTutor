import { describe, expect, it } from 'vitest'
import type { PlaybackEntry } from '@/types/playback'
import {
  GRACE_DEFAULT_RV,
  ornamentKindFromEnum,
  placeGraceNotes,
  realizeOrnament,
} from '@/audio/ornaments'

function baseEntry(overrides: Partial<PlaybackEntry> = {}): PlaybackEntry {
  return {
    startRv: 0,
    durationRv: 0.5,
    measureIndex: 2,
    noteIndex: 7,
    noteName: 'C5',
    ...overrides,
  }
}

/** 简写断言：[音名, 起刻, 时值] 序列 */
function sliceShape(entries: PlaybackEntry[]): Array<[string, number, number]> {
  return entries.map((entry) => [entry.noteName, entry.startRv, entry.durationRv])
}

describe('ornamentKindFromEnum（OSMD OrnamentEnum 数值映射）', () => {
  it('0–6 全映射；越界/未知返回 null', () => {
    expect([
      ornamentKindFromEnum(0),
      ornamentKindFromEnum(1),
      ornamentKindFromEnum(2),
      ornamentKindFromEnum(3),
      ornamentKindFromEnum(4),
      ornamentKindFromEnum(5),
      ornamentKindFromEnum(6),
    ]).toEqual([
      'trill',
      'turn',
      'inverted-turn',
      'delayed-turn',
      'delayed-inverted-turn',
      'mordent',
      'inverted-mordent',
    ])
    expect(ornamentKindFromEnum(7)).toBeNull()
    expect(ornamentKindFromEnum(-1)).toBeNull()
  })
})

describe('realizeOrnament（OSMD 切片语义，docs/audio.md §2.2-9）', () => {
  it('trill：8 等分主音/上邻音交替，子条目继承主音 noteIndex/measureIndex', () => {
    const slices = realizeOrnament(baseEntry({ durationRv: 0.5 }), 'trill', 'D5', 'B4')
    expect(sliceShape(slices)).toEqual([
      ['C5', 0, 0.0625],
      ['D5', 0.0625, 0.0625],
      ['C5', 0.125, 0.0625],
      ['D5', 0.1875, 0.0625],
      ['C5', 0.25, 0.0625],
      ['D5', 0.3125, 0.0625],
      ['C5', 0.375, 0.0625],
      ['D5', 0.4375, 0.0625],
    ])
    for (const entry of slices) {
      expect(entry.noteIndex).toBe(7)
      expect(entry.measureIndex).toBe(2)
    }
  })

  it('turn：4 等分上起回音；inverted-turn：下起', () => {
    const base = baseEntry({ durationRv: 0.25 })
    expect(sliceShape(realizeOrnament(base, 'turn', 'D5', 'B4'))).toEqual([
      ['D5', 0, 0.0625],
      ['C5', 0.0625, 0.0625],
      ['B4', 0.125, 0.0625],
      ['C5', 0.1875, 0.0625],
    ])
    expect(sliceShape(realizeOrnament(base, 'inverted-turn', 'D5', 'B4'))).toEqual([
      ['B4', 0, 0.0625],
      ['C5', 0.0625, 0.0625],
      ['D5', 0.125, 0.0625],
      ['C5', 0.1875, 0.0625],
    ])
  })

  it('delayed-turn：主音占前半、后半回音图形；delayed-inverted-turn 镜像', () => {
    const base = baseEntry({ durationRv: 0.5 })
    expect(sliceShape(realizeOrnament(base, 'delayed-turn', 'D5', 'B4'))).toEqual([
      ['C5', 0, 0.25],
      ['D5', 0.25, 0.0625],
      ['C5', 0.3125, 0.0625],
      ['B4', 0.375, 0.0625],
      ['C5', 0.4375, 0.0625],
    ])
    expect(sliceShape(realizeOrnament(base, 'delayed-inverted-turn', 'D5', 'B4'))[1]).toEqual([
      'B4',
      0.25,
      0.0625,
    ])
  })

  it('mordent：主音(1/4)+下邻音(1/4)+主音(1/2)；inverted-mordent 上邻音（MusicXML 语义）', () => {
    const base = baseEntry({ durationRv: 0.25 })
    expect(sliceShape(realizeOrnament(base, 'mordent', 'D5', 'B4'))).toEqual([
      ['C5', 0, 0.0625],
      ['B4', 0.0625, 0.0625],
      ['C5', 0.125, 0.125],
    ])
    expect(sliceShape(realizeOrnament(base, 'inverted-mordent', 'D5', 'B4'))).toEqual([
      ['C5', 0, 0.0625],
      ['D5', 0.0625, 0.0625],
      ['C5', 0.125, 0.125],
    ])
  })

  it('切片总时值守恒 = 主音 durationRv', () => {
    for (const kind of [
      'trill',
      'turn',
      'inverted-turn',
      'delayed-turn',
      'delayed-inverted-turn',
      'mordent',
      'inverted-mordent',
    ] as const) {
      const slices = realizeOrnament(baseEntry({ durationRv: 0.375, startRv: 1 }), kind, 'D5', 'B4')
      const total = slices.reduce((acc, entry) => acc + entry.durationRv, 0)
      expect(total).toBeCloseTo(0.375, 12)
      expect(slices[0]!.startRv).toBe(1)
    }
  })
})

describe('placeGraceNotes（倚音时间安放，docs/audio.md §2.2-8）', () => {
  it('主音前空闲充足：整块前移贴主音起点，主音不动', () => {
    const placement = placeGraceNotes(1, 1, 0.5, 0.5)
    expect(placement).toEqual({
      startsRv: [1 - GRACE_DEFAULT_RV],
      durationRv: GRACE_DEFAULT_RV,
      mainShiftRv: 0,
    })
  })

  it('无空闲（前条目紧贴）：整块挤占主音头部，主音顺延、时长扣减', () => {
    const placement = placeGraceNotes(2, 1, 0.5, 1)
    expect(placement).not.toBeNull()
    expect(placement!.startsRv).toEqual([1, 1 + GRACE_DEFAULT_RV])
    expect(placement!.durationRv).toBe(GRACE_DEFAULT_RV)
    expect(placement!.mainShiftRv).toBe(2 * GRACE_DEFAULT_RV)
  })

  it('部分空闲：先吃空闲、差额挤主音', () => {
    const placement = placeGraceNotes(1, 1, 0.5, 1 - GRACE_DEFAULT_RV / 2)
    expect(placement!.startsRv).toEqual([1 - GRACE_DEFAULT_RV / 2])
    expect(placement!.durationRv).toBe(GRACE_DEFAULT_RV)
    expect(placement!.mainShiftRv).toBeCloseTo(GRACE_DEFAULT_RV / 2, 12)
  })

  it('倚音总时值钳到主音一半；多倚音均分', () => {
    const placement = placeGraceNotes(3, 0, 0.125, 0)
    expect(placement).not.toBeNull()
    expect(placement!.durationRv).toBeCloseTo(0.125 / 3 / 2, 12)
    expect(placement!.mainShiftRv).toBeCloseTo(0.125 / 2, 12)
  })

  it('主音过短无处安放：null（整组丢弃）', () => {
    expect(placeGraceNotes(0, 0, 1, 0)).toBeNull()
    expect(placeGraceNotes(2, 0, 0, 0)).toBeNull()
  })
})
