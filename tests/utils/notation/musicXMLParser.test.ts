import { describe, expect, it } from 'vitest'
import { parse } from 'musicxml-io'

import { FALLBACK_TEMPO, fifthsToKeySignature, scoreToParsedScore, transposeSemitonesByMeasure } from '@/utils/notation/musicXMLParser'

/** 最小 score-partwise 骨架（spike 实测 io 要求 part-list + part）；head 默认带 work-title */
function scoreXml(measures: string, head = '<work><work-title>Fixture</work-title></work>'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  ${head}
  <identification><creator type="composer">Test Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measures}
  </part>
</score-partwise>`
}

function measure(number: string, body: string): string {
  return `<measure number="${number}">${body}</measure>`
}

const ATTRS_44 = '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>'
const QUARTER_C4 = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>'

describe('scoreToParsedScore 元信息', () => {
  it('title 取 workTitle、composer 取 creators[type=composer]', () => {
    const parsed = scoreToParsedScore(parse(scoreXml(measure('1', ATTRS_44 + QUARTER_C4))))
    expect(parsed.title).toBe('Fixture')
    expect(parsed.composer).toBe('Test Composer')
  })

  it('无 work-title 时回落 movementTitle（spike §13-V2）', () => {
    const xml = scoreXml(
      measure('1', ATTRS_44 + QUARTER_C4),
      '<movement-title>Movement Title</movement-title>',
    )
    const parsed = scoreToParsedScore(parse(xml))
    expect(parsed.title).toBe('Movement Title')
  })

  it('tempo 取首个 <sound tempo>，缺失兜底 60（spike §13-V5）', () => {
    const withTempo = scoreToParsedScore(
      parse(scoreXml(measure('1', ATTRS_44 + '<sound tempo="90"/>' + QUARTER_C4))),
    )
    expect(withTempo.tempo).toBe(90)

    const withoutTempo = scoreToParsedScore(parse(scoreXml(measure('1', ATTRS_44 + QUARTER_C4))))
    expect(withoutTempo.tempo).toBe(FALLBACK_TEMPO)
    expect(FALLBACK_TEMPO).toBe(60)
  })

  it('tempo 也识别 direction 的 sound.tempo；拍号/调号取首个声明', () => {
    const body =
      ATTRS_44 +
      '<direction><direction-type><words>Allegro</words></direction-type><sound tempo="120"/></direction>' +
      QUARTER_C4
    const parsed = scoreToParsedScore(parse(scoreXml(measure('1', body))))
    expect(parsed.tempo).toBe(120)
    expect(parsed.timeSignature).toBe('4/4')
    expect(parsed.keySignature).toBe('C major')
    expect(parsed.divisions).toBe(4)
  })

  it('composite 拍号受 io 0.2.11 限制退化为首个数字（"3+2" → "3"，见 docs/musicxml.md §4.9）', () => {
    const attrs = '<attributes><divisions>4</divisions><time><beats>3+2</beats><beat-type>8</beat-type></time></attributes>'
    const parsed = scoreToParsedScore(parse(scoreXml(measure('1', attrs + QUARTER_C4))))
    expect(parsed.timeSignature).toBe('3/8')
  })

  it('fifths → 调名：major / minor 用关系小调', () => {
    expect(fifthsToKeySignature(0)).toBe('C major')
    expect(fifthsToKeySignature(1)).toBe('G major')
    expect(fifthsToKeySignature(-1)).toBe('F major')
    expect(fifthsToKeySignature(7)).toBe('C# major')
    expect(fifthsToKeySignature(-7)).toBe('Cb major')
    expect(fifthsToKeySignature(1, 'minor')).toBe('E minor')
    expect(fifthsToKeySignature(0, 'minor')).toBe('A minor')
  })

  it('只取 parts[0]（决策 M3）', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>P1</part-name></score-part>
    <score-part id="P2"><part-name>P2</part-name></score-part>
  </part-list>
  <part id="P1"><measure number="1">${ATTRS_44}${QUARTER_C4}</measure></part>
  <part id="P2"><measure number="1">${ATTRS_44}<note><pitch><step>G</step><octave>2</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note></measure></part>
</score-partwise>`
    const parsed = scoreToParsedScore(parse(xml))
    expect(parsed.measures).toHaveLength(1)
    expect(parsed.measures[0]!.notes[0]!.pitch).toBe('C4')
  })
})

describe('scoreToParsedScore 音符映射', () => {
  it('realValue 是权威时值：四分 = 0.25，附点四分 = 0.375（spike §13-V7）', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>' +
      '<note><pitch><step>D</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice><type>quarter</type><dot/></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]).toMatchObject({ pitch: 'C4', duration: 'q', realValue: 0.25, dots: 0 })
    expect(notes[1]).toMatchObject({ pitch: 'D4', duration: 'q.', realValue: 0.375, dots: 1 })
  })

  it('realValue 随逐小节有效 divisions 换算（决策 M4：覆写/继承）', () => {
    const m1 = measure('1', ATTRS_44 + '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>')
    const m2 = measure('2', '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>')
    const m3 = measure('3', '<attributes><divisions>8</divisions></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>quarter</type></note>')
    const parsed = scoreToParsedScore(parse(scoreXml(`${m1}${m2}${m3}`)))
    // m2 无 attributes：继承 divisions=4（Measure.divisions 为 undefined）
    expect(parsed.measures[0]!.divisions).toBe(4)
    expect(parsed.measures[1]!.divisions).toBeUndefined()
    expect(parsed.measures[2]!.divisions).toBe(8)
    expect(parsed.measures[0]!.notes[0]!.realValue).toBeCloseTo(0.25, 6)
    expect(parsed.measures[1]!.notes[0]!.realValue).toBeCloseTo(0.25, 6)
    expect(parsed.measures[2]!.notes[0]!.realValue).toBeCloseTo(0.25, 6)
  })

  it('连音：duration 已含缩放，realValue 直算 = 1/12；tuplet 记录比率（决策 M5）', () => {
    const tripletEighth =
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type>' +
      '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification></note>'
    const body = `<attributes><divisions>12</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes>${tripletEighth}`
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.realValue).toBeCloseTo(1 / 12, 6)
    expect(note.tuplet).toEqual({ actualNotes: 3, normalNotes: 2 })
    expect(note.duration).toBe('8')
  })

  it('休止符：isRest + pitch "rest"，照常产出 Note 占位', () => {
    const body = ATTRS_44 + '<note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note).toMatchObject({ pitch: 'rest', isRest: true, octave: 0, realValue: 0.25 })
  })

  it('和弦音：isChord 标记、按出现顺序入 notes', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>' +
      '<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes).toHaveLength(2)
    expect(notes[0]!.isChord).toBeUndefined()
    expect(notes[1]!).toMatchObject({ pitch: 'E4', isChord: true })
  })

  it('alter → accidentals 标签', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>' +
      '<note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]).toMatchObject({ pitch: 'F4', accidentals: '#' })
    expect(notes[1]).toMatchObject({ pitch: 'B4', accidentals: 'b' })
  })

  it('tie 只如实标记不合并（决策 M6）：start / stop；ties 同现 stop+start 推导 continue（io 不产出 continue）', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><tie type="start"/></note>' +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><tie type="stop"/><tie type="start"/></note>' +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><tie type="stop"/></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]!.tie).toBe('start')
    expect(notes[1]!.tie).toBe('continue')
    expect(notes[2]!.tie).toBe('stop')
  })

  it('倚音：duration=0 → realValue 0；slash 区分短/长倚音（§4.5）', () => {
    const body =
      ATTRS_44 +
      '<note><grace slash="yes"/><pitch><step>D</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>' +
      '<note><grace/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><type>quarter</type></note>' +
      QUARTER_C4
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]).toMatchObject({ isGrace: true, graceSlash: true, realValue: 0 })
    expect(notes[1]).toMatchObject({ isGrace: true, graceSlash: false })
    expect(notes[2]!.isGrace).toBeUndefined()
  })

  it('倚音变化音 + 倚音和弦：pitch/accidentals 照常映射，和弦音同样 isGrace + isChord（§4.5）', () => {
    // steal-time_* 百分比属性 io 0.2.11 丢弃、契约无承载（占用策略由播放域决定，v2 整体跳过）
    const body =
      ATTRS_44 +
      '<note><grace steal-time_previous="20"/><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><voice>1</voice><type>eighth</type></note>' +
      '<note><grace/><chord/><pitch><step>A</step><octave>5</octave></pitch><voice>1</voice><type>eighth</type></note>' +
      QUARTER_C4
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]).toMatchObject({
      pitch: 'F5', accidentals: '#', isGrace: true, graceSlash: false, realValue: 0, duration: '8',
    })
    expect(notes[1]).toMatchObject({
      pitch: 'A5', isGrace: true, isChord: true, graceSlash: false, realValue: 0,
    })
    expect(notes[2]).toMatchObject({ pitch: 'C4', realValue: 0.25 })
    expect(notes[2]!.isGrace).toBeUndefined()
  })

  it('cue 音：isCue 标记、占时值', () => {
    const body =
      ATTRS_44 +
      '<note><cue/><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.isCue).toBe(true)
    expect(note.realValue).toBe(0.25)
  })

  it('unpitched：pitch 取 displayStep/Octave 拼接 + markings "unpitched"（§4.8）', () => {
    const body =
      ATTRS_44 +
      '<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><voice>1</voice><type>quarter</type></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.pitch).toBe('C5')
    expect(note.markings).toContain('unpitched')
  })

  it('noteType 反推不中 → "x"', () => {
    const body = ATTRS_44 + '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.duration).toBe('x')
  })

  it('voice/staff 透传', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><staff>2</staff><type>quarter</type></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.voice).toBe(2)
    expect(note.staff).toBe(2)
  })
})

describe('scoreToParsedScore 标记域（capture-only，决策 M8）', () => {
  it('演奏记号/装饰音/技法/延音记号/琶音 → 扁平标签', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><articulations><accent/></articulations><ornaments><trill-mark/></ornaments><technical><up-bow/></technical><fermata/><arpeggiate/></notations></note>'
    const note = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes[0]!
    expect(note.markings).toEqual(
      expect.arrayContaining(['articulation:accent', 'ornament:trill-mark', 'technical:up-bow', 'fermata', 'arpeggiate']),
    )
  })

  it('装饰音全家族 → ornament:<name> 原样透传（§4.6，io 0.2.11 实测可产出的 13 种）', () => {
    // io 0.2.11 类型声明 15 种，实测 <other-ornament> 与 <inverted-vertical-turn> 被解析丢弃（§7-I9）
    const ornaments = [
      'trill-mark', 'mordent', 'inverted-mordent', 'turn', 'inverted-turn',
      'delayed-turn', 'delayed-inverted-turn', 'vertical-turn',
      'shake', 'wavy-line', 'schleifer', 'tremolo', 'haydn',
    ] as const
    const notes = ornaments
      .map((o) =>
        `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>` +
        `<notations><ornaments><${o}/></ornaments></notations></note>`,
      )
      .join('')
    const attrs =
      `<attributes><divisions>4</divisions><time><beats>${ornaments.length}</beats><beat-type>4</beat-type></time></attributes>`
    const out = scoreToParsedScore(parse(scoreXml(measure('1', attrs + notes)))).measures[0]!.notes
    expect(out.map((note) => note.markings)).toEqual(ornaments.map((o) => [`ornament:${o}`]))
  })

  it('other-ornament / inverted-vertical-turn：io 0.2.11 不产出（notations 整体丢弃，§7-I9）', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><ornaments><other-ornament>sweep</other-ornament></ornaments></notations></note>' +
      '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><ornaments><inverted-vertical-turn/></ornaments></notations></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]!.markings).toBeUndefined()
    expect(notes[1]!.markings).toBeUndefined()
  })

  it('装饰音修饰属性不透出：mordent long="yes"、trill-mark accelerate/beath 只留记号名（§7-I9）', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><ornaments><mordent long="yes"/></ornaments></notations></note>' +
      '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><ornaments><trill-mark accelerate="yes" beath="3"/></ornaments></notations></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]!.markings).toEqual(['ornament:mordent'])
    expect(notes[1]!.markings).toEqual(['ornament:trill-mark'])
  })

  it('连线 slur → slur:<type>#<number>；仅 tied（无 note/tie）不设 Note.tie（§4.1 以 note/tie 为准）', () => {
    const body =
      ATTRS_44 +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><slur type="start" number="1"/><tied type="start"/></notations></note>' +
      '<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type>' +
      '<notations><slur type="stop" number="1"/><tied type="stop"/></notations></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]!.markings).toEqual(['slur:start#1'])
    expect(notes[1]!.markings).toEqual(['slur:stop#1'])
    expect(notes[0]!.tie).toBeUndefined()
  })

  it('direction 瞬时力度挂到其后第一条 note；乐句末尾的 direction 丢弃（§4.7）', () => {
    const body =
      ATTRS_44 +
      '<direction placement="below"><direction-type><dynamics><mf/></dynamics></direction-type></direction>' +
      QUARTER_C4 +
      '<direction placement="below"><direction-type><dynamics><pp/></dynamics></direction-type></direction>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes[0]!.markings).toEqual(['dynamics:mf'])
  })

  it('多小节休止：Measure.multipleRest 标注（§4.3）', () => {
    const attrs =
      '<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time>' +
      '<measure-style><multiple-rest>3</multiple-rest></measure-style></attributes>'
    const body = attrs + '<note><rest measure="yes"/><duration>16</duration><voice>1</voice></note>'
    const measure0 = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!
    expect(measure0.multipleRest).toBe(3)
    expect(measure0.notes[0]!.isRest).toBe(true)
  })

  it('forward/backup 游标跳过不产出 Note（§4.3）', () => {
    const body =
      ATTRS_44 +
      '<forward><duration>4</duration></forward>' +
      QUARTER_C4 +
      '<backup><duration>4</duration></backup>' +
      '<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type></note>'
    const notes = scoreToParsedScore(parse(scoreXml(measure('1', body)))).measures[0]!.notes
    expect(notes).toHaveLength(2)
    expect(notes.map((note) => note.voice)).toEqual([1, 2])
  })
})

describe('scoreToParsedScore 小节属性变更', () => {
  it('拍号/调号变更记到生效小节；无变更为 undefined', () => {
    const m1 = measure('1', ATTRS_44 + QUARTER_C4)
    const m2 = measure('2', QUARTER_C4)
    const m3 = measure(
      '3',
      '<attributes><divisions>4</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' +
        QUARTER_C4,
    )
    const measures = scoreToParsedScore(parse(scoreXml(`${m1}${m2}${m3}`))).measures
    expect(measures[0]!.timeSignature).toBe('4/4')
    expect(measures[1]!.timeSignature).toBeUndefined()
    expect(measures[1]!.keySignature).toBeUndefined()
    expect(measures[2]!.timeSignature).toBe('3/4')
    expect(measures[2]!.keySignature).toBe('G major')
  })

  it('顶层拍号/调号/divisions 取首个声明，后续变更只进对应小节（docs/musicxml.md §2）', () => {
    const m1 = measure('1', ATTRS_44 + QUARTER_C4)
    const m2 = measure('2', '<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' + QUARTER_C4)
    const m3 = measure(
      '3',
      '<attributes><divisions>8</divisions><key><fifths>2</fifths></key><time><beats>2</beats><beat-type>2</beat-type></time></attributes>' +
        '<note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>quarter</type></note>',
    )
    const parsed = scoreToParsedScore(parse(scoreXml(`${m1}${m2}${m3}`)))
    expect(parsed.timeSignature).toBe('4/4')
    expect(parsed.keySignature).toBe('C major')
    expect(parsed.divisions).toBe(4)
    expect(parsed.measures[2]!.timeSignature).toBe('2/2')
    expect(parsed.measures[2]!.keySignature).toBe('D major')
    expect(parsed.measures[2]!.divisions).toBe(8)
  })

  it('小节 index 从 0 连续编号', () => {
    const measures = scoreToParsedScore(parse(scoreXml(`${measure('1', ATTRS_44 + QUARTER_C4)}${measure('2', QUARTER_C4)}`))).measures
    expect(measures.map((m) => m.index)).toEqual([0, 1])
  })
})

describe('移调 attributes/transpose（docs/musicxml.md §3 行 19，决策 M11）', () => {
  const SAX_TRANSPOSE = '<transpose><diatonic>-5</diatonic><chromatic>-9</chromatic></transpose>'
  // transpose 是 attributes 的子元素：须拼在 </attributes> 之内（measure 直下 io 不认）
  const SAX_ATTRS =
    '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>' +
    SAX_TRANSPOSE +
    '</attributes>'

  it('transpose 声明入 Measure（中音萨克斯 -5/-9）；未声明小节 undefined = 继承', () => {
    const parsed = scoreToParsedScore(
      parse(scoreXml(`${measure('1', SAX_ATTRS + QUARTER_C4)}${measure('2', QUARTER_C4)}`)),
    )
    expect(parsed.measures[0]!.transpose).toEqual({ diatonic: -5, chromatic: -9 })
    expect(parsed.measures[1]!.transpose).toBeUndefined()
  })

  it('octave-change 原样透传；io 产出双 transpose 时只留首个（0.2.11 实测）', () => {
    const attrs = '<attributes><divisions>4</divisions>' +
      '<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic><octave-change>-1</octave-change></transpose>' +
      '<transpose><diatonic>-2</diatonic><chromatic>-3</chromatic></transpose></attributes>'
    const parsed = scoreToParsedScore(parse(scoreXml(measure('1', attrs + QUARTER_C4))))
    expect(parsed.measures[0]!.transpose).toEqual({ diatonic: -1, chromatic: -2, octaveChange: -1 })
  })

  it('transposeSemitonesByMeasure：覆写继承（M4 同款），半音 = chromatic + 12×octaveChange', () => {
    const octaveDown = '<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic><octave-change>-1</octave-change></transpose>'
    const parsed = scoreToParsedScore(
      parse(scoreXml(
        measure('1', SAX_ATTRS + QUARTER_C4) +
        measure('2', QUARTER_C4) +
        measure('3', '<attributes>' + octaveDown + '</attributes>' + QUARTER_C4) +
        measure('4', QUARTER_C4),
      )),
    )
    expect(transposeSemitonesByMeasure(parsed)).toEqual([-9, -9, -14, -14])
  })

  it('无 transpose 声明的谱：全 0（C 调乐器原样播放）', () => {
    const parsed = scoreToParsedScore(parse(scoreXml(`${measure('1', ATTRS_44 + QUARTER_C4)}${measure('2', QUARTER_C4)}`)))
    expect(transposeSemitonesByMeasure(parsed)).toEqual([0, 0])
  })
})
