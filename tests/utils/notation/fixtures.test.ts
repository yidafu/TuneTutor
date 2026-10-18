import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Note, ParsedScore } from '@/types/notation'
import { processFile } from '@/utils/notation/processFile'

/**
 * 标记域/节奏型/调号夹具的集成测试（docs/musicxml.md §8 集成层）：
 * 每份 musicxml/*.musicxml 走完整 processFile 管线（良构闸 → io parse → scoreToParsedScore），
 * 夹具本体可供浏览器手动导入渲染（OSMD 与解析器同吃一份文本，决策 M2）。
 * 解析形状以 musicxml-io 0.2.11 实测为准（docs/musicxml.md §7）。
 */

// vitest 以仓库根为 cwd；夹具是数据文件不参与打包，不经 vite 资源管线
const FIXTURES_DIR = path.resolve(process.cwd(), 'musicxml')

async function importFixture(name: string): Promise<ParsedScore> {
  const xml = readFileSync(path.join(FIXTURES_DIR, name), 'utf-8')
  const { parsedScore } = await processFile(
    new File([xml], name, { type: 'application/vnd.recordare.musicxml+xml' }),
  )
  return parsedScore
}

function noteAt(parsed: ParsedScore, measureIndex: number, noteIndex: number): Note {
  const note = parsed.measures[measureIndex]!.notes[noteIndex]
  expect(note, `measure ${measureIndex} note ${noteIndex}`).toBeDefined()
  return note!
}

function realValues(parsed: ParsedScore, measureIndex: number): number[] {
  return parsed.measures[measureIndex]!.notes.map((note) => note.realValue)
}

/** 小节内所有音符 realValue 之和 = 拍号全长（夹具小节均填满、无倚音） */
function expectMeasureFilled(parsed: ParsedScore, measureIndex: number, wholeNotes: number): void {
  const sum = parsed.measures[measureIndex]!.notes.reduce((acc, note) => acc + note.realValue, 0)
  expect(sum).toBeCloseTo(wholeNotes, 6)
}

describe('标记夹具：延音线 marks-tie（docs/musicxml.md §4.1，决策 M6）', () => {
  it('小节内 tie：start/stop 成对，解析层不合并', async () => {
    const parsed = await importFixture('marks-tie.musicxml')
    expect(parsed.title).toBe('Tie Marks Fixture')
    const notes = parsed.measures[0]!.notes
    expect(notes).toHaveLength(2)
    expect(notes[0]).toMatchObject({ pitch: 'C5', tie: 'start', realValue: 0.5 })
    expect(notes[1]).toMatchObject({ pitch: 'C5', tie: 'stop', realValue: 0.5 })
    // M6：逐音符事实，无合并字段
    expect(notes[0]!.realValue + notes[1]!.realValue).toBeCloseTo(1, 6)
  })

  it('跨小节 tie 链：中段既止又起推导为 continue（io 不产出 continue）', async () => {
    const parsed = await importFixture('marks-tie.musicxml')
    expect(noteAt(parsed, 1, 0)).toMatchObject({ pitch: 'D5', tie: 'start' })
    expect(noteAt(parsed, 2, 0)).toMatchObject({ pitch: 'D5', tie: 'continue' })
    expect(noteAt(parsed, 3, 0)).toMatchObject({ pitch: 'D5', tie: 'stop' })
    // 每段各 0.25，整链 0.75；延音合并只发生在 buildPlaybackData（audio.md §2.2-2）
    expect(noteAt(parsed, 1, 0)!.realValue).toBeCloseTo(0.25, 6)
  })

  it('tied notations 不进 markings（tie 由 Note.tie 字段承载）', async () => {
    const parsed = await importFixture('marks-tie.musicxml')
    expect(noteAt(parsed, 0, 0)!.markings).toBeUndefined()
    expect(noteAt(parsed, 3, 1)).toMatchObject({ pitch: 'rest', isRest: true })
  })
})

describe('标记夹具：圆滑线 marks-slur（§4.2）', () => {
  it('小节内 slur：slur:<type>#<number> 标签', async () => {
    const parsed = await importFixture('marks-slur.musicxml')
    expect(noteAt(parsed, 0, 0)!.markings).toEqual(['slur:start#1'])
    expect(noteAt(parsed, 0, 1)!.markings).toBeUndefined()
    expect(noteAt(parsed, 0, 3)!.markings).toEqual(['slur:stop#1'])
  })

  it('跨小节 slur + continue 段（实测 io slurType 原样透传）', async () => {
    const parsed = await importFixture('marks-slur.musicxml')
    expect(noteAt(parsed, 1, 0)!.markings).toEqual(['slur:start#1'])
    expect(noteAt(parsed, 2, 0)!.markings).toEqual(['slur:continue#1'])
    expect(noteAt(parsed, 2, 3)!.markings).toEqual(['slur:stop#1'])
  })

  it('嵌套 slur 按 number 区分，保持 XML 出现顺序', async () => {
    const parsed = await importFixture('marks-slur.musicxml')
    expect(noteAt(parsed, 3, 0)!.markings).toEqual(['slur:start#2', 'slur:start#1'])
    expect(noteAt(parsed, 3, 1)!.markings).toEqual(['slur:start#1'])
    expect(noteAt(parsed, 3, 2)!.markings).toEqual(['slur:stop#1'])
    expect(noteAt(parsed, 3, 3)!.markings).toEqual(['slur:stop#2'])
    // slur 不是 tie：不同音高间弧线不设 Note.tie（§4.1 负例）
    expect(noteAt(parsed, 0, 0)!.tie).toBeUndefined()
  })
})

describe('标记夹具：倚音 marks-grace（§4.5）', () => {
  it('长倚音（appoggiatura，无 slash）：isGrace、realValue 0、不占时值', async () => {
    const parsed = await importFixture('marks-grace.musicxml')
    expect(noteAt(parsed, 0, 0)).toMatchObject({
      pitch: 'E5', isGrace: true, graceSlash: false, realValue: 0, duration: 'q',
    })
    // 主音照常占时值（isGrace 字段不出现于普通音符）
    expect(noteAt(parsed, 0, 1)!.isGrace).toBeUndefined()
    expect(noteAt(parsed, 0, 1)).toMatchObject({ pitch: 'C5', realValue: 0.5 })
  })

  it('短倚音（acciaccatura，slash=yes）：graceSlash true', async () => {
    const parsed = await importFixture('marks-grace.musicxml')
    expect(noteAt(parsed, 1, 0)).toMatchObject({ pitch: 'A5', isGrace: true, graceSlash: true, realValue: 0 })
  })

  it('连续多倚音 + 倚音可携带 slur 标记', async () => {
    const parsed = await importFixture('marks-grace.musicxml')
    expect(noteAt(parsed, 2, 0)).toMatchObject({ pitch: 'D5', isGrace: true })
    expect(noteAt(parsed, 2, 1)).toMatchObject({ pitch: 'E5', isGrace: true })
    expect(noteAt(parsed, 2, 2)).toMatchObject({ pitch: 'C5' })
    expect(noteAt(parsed, 2, 2)!.isGrace).toBeUndefined()
    // 倚音→主音的连线：倚音占 graphicIndex 且承载 markings
    expect(noteAt(parsed, 3, 0)!.markings).toEqual(['slur:start#1'])
    expect(noteAt(parsed, 3, 1)!.markings).toEqual(['slur:stop#1'])
  })
})

describe('标记夹具：装饰音记号（capture-only，决策 M8）', () => {
  it('波音 marks-mordent：mordent / inverted-mordent；long 属性不透出（io 0.2.11 只留记号名）', async () => {
    const parsed = await importFixture('marks-mordent.musicxml')
    expect(noteAt(parsed, 0, 0)!.markings).toEqual(['ornament:mordent'])
    expect(noteAt(parsed, 0, 1)!.markings).toEqual(['ornament:inverted-mordent'])
    expect(noteAt(parsed, 1, 0)!.markings).toEqual(['ornament:mordent'])
    expect(noteAt(parsed, 0, 2)!.markings).toBeUndefined()
  })

  it('回音 marks-turn：turn / inverted-turn / delayed-turn', async () => {
    const parsed = await importFixture('marks-turn.musicxml')
    expect(noteAt(parsed, 0, 0)!.markings).toEqual(['ornament:turn'])
    expect(noteAt(parsed, 0, 1)!.markings).toEqual(['ornament:inverted-turn'])
    expect(noteAt(parsed, 1, 0)!.markings).toEqual(['ornament:delayed-turn'])
  })

  it('颤音 marks-trill：trill-mark 与 wavy-line 各为独立标签（wavy-line 跨小节起止均同名）', async () => {
    const parsed = await importFixture('marks-trill.musicxml')
    expect(noteAt(parsed, 0, 0)!.markings).toEqual(['ornament:trill-mark', 'ornament:wavy-line'])
    // 波浪线 stop 端只留记号名——capture-only 文法不含起止方向（docs/musicxml.md §2）
    expect(noteAt(parsed, 1, 0)!.markings).toEqual(['ornament:wavy-line'])
    expect(noteAt(parsed, 1, 1)!.markings).toEqual(['ornament:trill-mark'])
    expect(noteAt(parsed, 1, 2)!.markings).toBeUndefined()
  })
})

describe('节奏型夹具（realValue 是时值唯一权威，决策 M5）', () => {
  it('rhythm-mixed：附点/复附点/十六分/休止的 realValue 精确换算', async () => {
    const parsed = await importFixture('rhythm-mixed.musicxml')
    expect(realValues(parsed, 0)).toEqual([1])
    expect(realValues(parsed, 1)).toEqual([0.75, 0.25])
    expect(noteAt(parsed, 1, 0)).toMatchObject({ duration: 'h.', dots: 1 })
    expect(realValues(parsed, 2)).toEqual([0.375, 0.125, 0.25, 0.25])
    expect(realValues(parsed, 3)).toEqual([0.25, 0.0625, 0.0625, 0.0625, 0.0625, 0.5])
    // 复附点二分：h..，dots=2
    expect(noteAt(parsed, 4, 0)).toMatchObject({ duration: 'h..', dots: 2, realValue: 0.875 })
    expect(realValues(parsed, 4)).toEqual([0.875, 0.125])
    expect(realValues(parsed, 5)).toEqual([0.25, 0.125, 0.125, 0.5])
    expect(noteAt(parsed, 5, 0)).toMatchObject({ pitch: 'rest', isRest: true })
    for (const [index] of parsed.measures.entries()) expectMeasureFilled(parsed, index, 1)
  })

  it('rhythm-tuplets：duration 已含缩放，realValue 直算（1/12、1/6、1/24）', async () => {
    const parsed = await importFixture('rhythm-tuplets.musicxml')
    expect(parsed.measures[0]!.divisions).toBe(12)
    // 三连八分：realValue = 1/12，显示标签仍是 '8'
    expect(noteAt(parsed, 0, 0)).toMatchObject({ duration: '8', tuplet: { actualNotes: 3, normalNotes: 2 } })
    expect(realValues(parsed, 0)).toEqual([1 / 12, 1 / 12, 1 / 12, 1 / 12, 1 / 12, 1 / 12, 0.25, 0.25])
    // 三连四分：realValue = 1/6
    expect(realValues(parsed, 1)).toEqual([1 / 6, 1 / 6, 1 / 6, 0.25, 0.125, 0.125])
    // 六连十六分（6:4）：realValue = 1/24
    expect(noteAt(parsed, 2, 0)).toMatchObject({ tuplet: { actualNotes: 6, normalNotes: 4 } })
    expect(realValues(parsed, 2)).toEqual([
      1 / 24, 1 / 24, 1 / 24, 1 / 24, 1 / 24, 1 / 24, 1 / 12, 1 / 12, 1 / 12, 0.5,
    ])
    for (const [index] of parsed.measures.entries()) expectMeasureFilled(parsed, index, 1)
  })

  it('rhythm-syncopation：弱起八分与附点切分序列', async () => {
    const parsed = await importFixture('rhythm-syncopation.musicxml')
    expect(realValues(parsed, 0)).toEqual([0.125, 0.25, 0.125, 0.25, 0.25])
    expect(realValues(parsed, 1)).toEqual([0.25, 0.375, 0.125, 0.25])
    expect(realValues(parsed, 2)).toEqual([0.125, 0.25, 0.125, 0.25, 0.125, 0.125])
    expect(realValues(parsed, 3)).toEqual([0.25, 0.125, 0.125, 0.25, 0.25])
    for (const [index] of parsed.measures.entries()) expectMeasureFilled(parsed, index, 1)
  })

  it('rhythm-meters：拍号变更记到生效小节，小节全长随拍号（0.75/1/1.25）', async () => {
    const parsed = await importFixture('rhythm-meters.musicxml')
    expect(parsed.timeSignature).toBe('3/4')
    expect(parsed.measures[0]!.timeSignature).toBe('3/4')
    expect(parsed.measures[1]!.timeSignature).toBeUndefined()
    expect(parsed.measures[2]!.timeSignature).toBe('6/8')
    expect(parsed.measures[4]!.timeSignature).toBe('2/2')
    expect(parsed.measures[6]!.timeSignature).toBe('5/4')
    expectMeasureFilled(parsed, 0, 0.75)
    expectMeasureFilled(parsed, 2, 0.75)
    expectMeasureFilled(parsed, 4, 1)
    expectMeasureFilled(parsed, 6, 1.25)
    expectMeasureFilled(parsed, 7, 1.25)
  })
})

describe('调号夹具（fifths → 调名，§4.9）', () => {
  it('keys-sharps：G → D → A 大调逐段变更，alter → accidentals', async () => {
    const parsed = await importFixture('keys-sharps.musicxml')
    expect(parsed.keySignature).toBe('G major')
    expect(parsed.measures.map((measure) => measure.keySignature)).toEqual([
      'G major', undefined, 'D major', undefined, 'A major', undefined,
    ])
    expect(noteAt(parsed, 1, 2)).toMatchObject({ pitch: 'F5', accidentals: '#' })
    expect(noteAt(parsed, 3, 2)).toMatchObject({ pitch: 'C5', accidentals: '#' })
    expect(noteAt(parsed, 5, 2)).toMatchObject({ pitch: 'G5', accidentals: '#' })
  })

  it('keys-flats：F → Bb → Eb 大调，降号 accidentals "b"', async () => {
    const parsed = await importFixture('keys-flats.musicxml')
    expect(parsed.measures.map((measure) => measure.keySignature)).toEqual([
      'F major', undefined, 'Bb major', undefined, 'Eb major', undefined,
    ])
    expect(noteAt(parsed, 0, 3)).toMatchObject({ pitch: 'B4', accidentals: 'b' })
    expect(noteAt(parsed, 4, 3)).toMatchObject({ pitch: 'A5', accidentals: 'b' })
  })

  it('keys-minor：mode=minor 用关系小调名，含和声小调临时升号', async () => {
    const parsed = await importFixture('keys-minor.musicxml')
    expect(parsed.measures.map((measure) => measure.keySignature)).toEqual([
      'A minor', undefined, 'E minor', undefined, 'C minor', undefined,
    ])
    // A 和声小调导音 G#
    expect(noteAt(parsed, 1, 2)).toMatchObject({ pitch: 'G5', accidentals: '#' })
    expect(noteAt(parsed, 3, 2)).toMatchObject({ pitch: 'D6', accidentals: '#' })
    expect(noteAt(parsed, 5, 1)).toMatchObject({ pitch: 'A5', accidentals: 'b' })
  })

  it('keys-extremes：fifths ±7 调名表边界', async () => {
    const parsed = await importFixture('keys-extremes.musicxml')
    expect(parsed.measures[0]!.keySignature).toBe('C# major')
    expect(parsed.measures[2]!.keySignature).toBe('Cb major')
    expect(noteAt(parsed, 0, 2)).toMatchObject({ pitch: 'E5', accidentals: '#' })
    expect(noteAt(parsed, 2, 3)).toMatchObject({ pitch: 'F5', accidentals: 'b' })
  })
})

describe('全量夹具导入回归（musicxml/ 下所有 .musicxml）', () => {
  const fixtures = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.musicxml')).sort()

  it('夹具清单在位（防误删）', () => {
    expect(fixtures).toEqual([
      'keys-extremes.musicxml',
      'keys-flats.musicxml',
      'keys-minor.musicxml',
      'keys-sharps.musicxml',
      'marks-grace.musicxml',
      'marks-mordent.musicxml',
      'marks-slur.musicxml',
      'marks-tie.musicxml',
      'marks-trill.musicxml',
      'marks-turn.musicxml',
      'rhythm-meters.musicxml',
      'rhythm-mixed.musicxml',
      'rhythm-syncopation.musicxml',
      'rhythm-tuplets.musicxml',
      // 目录里既有的真实样例谱（tie 组 2，docs/musicxml.md §7-I3）一并纳入导入回归
      '连音符.musicxml',
    ])
  })

  it.each(fixtures)('%s：走完整管线，基础契约成立', async (name) => {
    const parsed = await importFixture(name)
    expect(parsed.title).not.toBe('')
    expect(parsed.measures.length).toBeGreaterThan(0)
    expect(parsed.tempo).toBe(60) // 夹具均无 <sound tempo>，兜底路径（spike §13-V5）
    for (const measure of parsed.measures) {
      expect(measure.notes.length).toBeGreaterThan(0)
      for (const note of measure.notes) {
        expect(note.pitch).not.toBe('')
        expect(note.voice).toBeGreaterThan(0)
        expect(note.realValue).toBeGreaterThanOrEqual(0)
        if (note.isGrace === true) expect(note.realValue).toBe(0)
      }
    }
  })
})
