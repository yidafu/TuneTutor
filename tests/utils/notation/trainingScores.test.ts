import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ParsedScore } from '@/types/notation'
import { processFile } from '@/utils/notation/processFile'

/**
 * 节奏训练谱（musicxml/training/，docs/test-cases.md TC-IMP-*）：
 * 八分/十六分切分练习材料，音高语境对齐《世界赠予我的》——
 * written G 大调 + 中音萨克斯 transpose −5/−9、五声核心 G4–E5（⊆ 原谱 D4–B5）、tempo 62。
 * 放子目录不进 fixtures.test.ts 顶层夹具回归（那边断言 tempo==60 兜底路径）。
 */

const TRAINING_DIR = path.resolve(process.cwd(), 'musicxml/training')

const SCORE_FILES = {
  eighths: '八分音符节奏训练.musicxml',
  syncopation: '切分节奏训练.musicxml',
  sixteenths: '十六分音符节奏训练.musicxml',
} as const

/** 原谱五声核心音高（训练谱唯一音高集，docs/test-cases.md 样例谱清单） */
const ALLOWED_PITCHES = new Set(['G4', 'A4', 'B4', 'D5', 'E5'])

function readScoreXml(name: string): string {
  return readFileSync(path.join(TRAINING_DIR, name), 'utf-8')
}

async function importScore(name: string): Promise<ParsedScore> {
  const xml = readScoreXml(name)
  const { parsedScore } = await processFile(
    new File([xml], name, { type: 'application/vnd.recordare.musicxml+xml' }),
  )
  return parsedScore
}

function realValues(parsed: ParsedScore, measureIndex: number): number[] {
  return parsed.measures[measureIndex]!.notes.map((note) => note.realValue)
}

describe('训练谱全量导入回归（musicxml/training/）', () => {
  it('三份训练谱在位（防误删/误命名；只扫 .musicxml，允许源 PDF 等工作文件同居）', () => {
    const scores = readdirSync(TRAINING_DIR).filter((name) => name.endsWith('.musicxml')).sort()
    expect(scores).toEqual(Object.values(SCORE_FILES).sort())
  })

  it.each(Object.entries(SCORE_FILES))(
    '%s：走完整管线，tempo/调号/transpose/4/4 小节填满',
    async (_key, name) => {
      const parsed = await importScore(name)
      expect(parsed.title).toBe(name.replace('.musicxml', ''))
      expect(parsed.tempo).toBe(62) // 与《世界赠予我的》同速（<sound tempo> 直读路径）
      expect(parsed.timeSignature).toBe('4/4')
      expect(parsed.keySignature).toBe('G major')
      expect(parsed.measures).toHaveLength(20) // count-in + 4×(4 小节演奏段 + 换气空拍)，末段无换气
      expect(parsed.measures[0]!.transpose).toEqual({ diatonic: -5, chromatic: -9 }) // 中音萨克斯（M11）
      for (const [index, measure] of parsed.measures.entries()) {
        const sum = measure.notes.reduce((acc, note) => acc + note.realValue, 0)
        expect(sum, `measure ${index + 1}`).toBeCloseTo(1, 6)
        for (const note of measure.notes) expect(note.voice).toBe(1)
      }
    },
  )

  it('空拍结构：m1 count-in，此后每吹 4 小节整小节换气（m6/m11/m16），段内有实音', async () => {
    for (const name of Object.values(SCORE_FILES)) {
      const parsed = await importScore(name)
      for (const i of [0, 5, 10, 15]) {
        const notes = parsed.measures[i]!.notes
        expect(notes, `${name} m${i + 1}`).toHaveLength(1)
        expect(notes[0]).toMatchObject({ isRest: true, realValue: 1 }) // 普通 rest+type 路径
      }
      for (const i of [1, 6, 11, 16]) {
        expect(parsed.measures[i]!.notes.some((note) => !note.isRest), `${name} m${i + 1}`).toBe(true)
      }
    }
  })

  it('音高全部取自原谱五声核心 G4/A4/B4/D5/E5，无临时变音', async () => {
    for (const name of Object.values(SCORE_FILES)) {
      const parsed = await importScore(name)
      for (const measure of parsed.measures) {
        for (const note of measure.notes) {
          if (note.isRest) continue
          expect(ALLOWED_PITCHES, note.pitch).toContain(note.pitch)
          expect(note.accidentals).toBeUndefined()
        }
      }
    }
  })
})

describe('八分音符节奏训练', () => {
  it('递进：定拍四分 → 成对八分 → 反拍休止 → 全音符收尾', async () => {
    const parsed = await importScore(SCORE_FILES.eighths)
    expect(realValues(parsed, 1)).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(realValues(parsed, 3)).toEqual(Array<number>(8).fill(0.125))
    const m7 = parsed.measures[6]!.notes
    expect(m7).toHaveLength(8)
    m7.forEach((note, i) => expect(note.isRest, `note ${i + 1}`).toBe(i % 2 === 1))
    expect(realValues(parsed, 19)).toEqual([1])
  })

  it('成对八分显式 beam（begin/end），无二级 beam 与 hook', () => {
    const xml = readScoreXml(SCORE_FILES.eighths)
    expect(xml).toContain('<beam number="1">begin</beam>')
    expect(xml).not.toContain('<beam number="2">')
    expect(xml).not.toContain('hook')
  })
})

describe('切分节奏训练', () => {
  it('m2 ♪♩♪ 基本形；m7 反拍起长音 ♪𝅗𝅥♪♩；m8 极大切分 ♪𝅗𝅥.♪', async () => {
    const parsed = await importScore(SCORE_FILES.syncopation)
    expect(realValues(parsed, 1)).toEqual([0.125, 0.25, 0.125, 0.125, 0.25, 0.125])
    expect(realValues(parsed, 6)).toEqual([0.125, 0.5, 0.125, 0.25])
    expect(realValues(parsed, 7)).toEqual([0.125, 0.75, 0.125])
  })

  it('m18 空拍切入切分：形态同 ♪♩♪𝄾♩♪，第 4 音为八分休止', async () => {
    const parsed = await importScore(SCORE_FILES.syncopation)
    expect(realValues(parsed, 17)).toEqual([0.125, 0.25, 0.125, 0.125, 0.25, 0.125])
    expect(parsed.measures[17]!.notes[3]).toMatchObject({ isRest: true })
  })

  it('切分八分以旗尾呈现（无 hook；仅 m8 末拍 ♪♪ 一对 beam）', () => {
    const xml = readScoreXml(SCORE_FILES.syncopation)
    expect(xml).not.toContain('hook')
    expect(xml.match(/<beam /g)).toHaveLength(2)
  })
})

describe('十六分音符节奏训练', () => {
  it('阶段1 过渡小节 m2–5：前两拍 4 个八分 + 后两拍两组十六分', async () => {
    const parsed = await importScore(SCORE_FILES.sixteenths)
    const expected = [...Array(4).fill(0.125), ...Array(8).fill(0.0625)]
    for (const i of [1, 2, 3, 4]) {
      expect(realValues(parsed, i), `measure ${i + 1}`).toEqual(expected)
    }
  })

  it('阶段2 组合切分：m7 前八后十六 / m8 前十六后八 / m10 十六分切分 ♬♪♬', async () => {
    const parsed = await importScore(SCORE_FILES.sixteenths)
    expect(realValues(parsed, 6)).toEqual(Array(4).fill([0.125, 0.0625, 0.0625]).flat())
    expect(realValues(parsed, 7)).toEqual(Array(4).fill([0.0625, 0.0625, 0.125]).flat())
    expect(realValues(parsed, 9)).toEqual(Array(4).fill([0.0625, 0.125, 0.0625]).flat())
  })

  it('阶段3 深化：m12 前附点 ♪.♬ / m13 后附点 ♬♪. / m15 十六分休止弱起 𝄿♬♪', async () => {
    const parsed = await importScore(SCORE_FILES.sixteenths)
    expect(realValues(parsed, 11)).toEqual(Array(4).fill([0.1875, 0.0625]).flat())
    expect(realValues(parsed, 12)).toEqual(Array(4).fill([0.0625, 0.1875]).flat())
    const m15 = parsed.measures[14]!.notes
    expect(m15[0]).toMatchObject({ isRest: true, realValue: 0.0625 })
    expect(m15[1]).toMatchObject({ realValue: 0.0625 })
    expect(m15[2]).toMatchObject({ realValue: 0.125 })
  })

  it('显式 beam：二级 beam 与 forward/backward hook 在位（♬♪♬ 切分形，OSMD 需显式 beam）', () => {
    const xml = readScoreXml(SCORE_FILES.sixteenths)
    expect(xml).toContain('<beam number="2">begin</beam>')
    expect(xml).toContain('forward hook')
    expect(xml).toContain('backward hook')
  })
})
