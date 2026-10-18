import { describe, expect, it } from 'vitest'

import {
  applyBoxModifiers,
  computeLoopRange,
  createBoxSelection,
  createMeasureSelection,
  createPhraseSelection,
  dataEndRv,
  describeSelection,
  resolveEndpoint,
  summarizeSelection,
  type HitNote,
  type ScoreSelection,
} from '@/utils/notation/selection'
import { enUS } from '@/locales/en-US'
import type { PlaybackEntry } from '@/types/playback'

/** 手工构造播放数据：noteIndex 连续占位（休止无条目但占号，audio.md §2.2/§2.4） */
function entry(
  noteIndex: number,
  startRv: number,
  durationRv: number,
  measureIndex = 0,
): PlaybackEntry {
  return { noteIndex, startRv, durationRv, measureIndex, noteName: 'C4' }
}

function slot(noteIndex: number, measureIndex = 0): HitNote {
  return { noteIndex, measureIndex, endpoint: 'slot' }
}

/** 样例数据（四小节）：m0 首休止占号0；m1 音符1–2；m2 休止占号3；m3 音符4 */
const ENTRIES: PlaybackEntry[] = [
  entry(1, 1.0, 0.25, 1),
  entry(2, 1.25, 0.5, 1),
  entry(4, 2.0, 0.25, 3),
]

describe('resolveEndpoint（selection.md §2.3 四类规则）', () => {
  it('发音音符：区间 = [startRv, startRv + durationRv)', () => {
    expect(resolveEndpoint(slot(2, 1), ENTRIES, 'start')).toEqual({ startRv: 1.25, endRv: 1.75 })
  })

  it('休止符作为起点：= 前一条目末刻（无前条目则 0）', () => {
    // 曲首休止（noteIndex 0，无条目）：起点 = 0，终点 = 后条目起刻
    expect(resolveEndpoint(slot(0, 0), ENTRIES, 'start')).toEqual({ startRv: 0, endRv: 1.0 })
    // 曲中休止（noteIndex 3）：[1.75, 2.0]
    expect(resolveEndpoint(slot(3, 2), ENTRIES, 'start')).toEqual({ startRv: 1.75, endRv: 2.0 })
  })

  it('休止符作为终点：= 后一条目起刻（无后条目则曲终）', () => {
    expect(resolveEndpoint(slot(3, 2), ENTRIES, 'end')).toEqual({ startRv: 1.75, endRv: 2.0 })
    // 曲尾休止（noteIndex 5）：终点 = 末条目末刻
    expect(resolveEndpoint(slot(5, 4), ENTRIES, 'end')).toEqual({ startRv: 2.25, endRv: 2.25 })
  })

  it('装饰音：解析为下一个发音条目；其后无发音 → 无效', () => {
    const grace: HitNote = { noteIndex: 3, measureIndex: 2, endpoint: 'grace' }
    expect(resolveEndpoint(grace, ENTRIES, 'start')).toEqual({ startRv: 2.0, endRv: 2.25 })
    const trailingGrace: HitNote = { noteIndex: 5, measureIndex: 4, endpoint: 'grace' }
    expect(resolveEndpoint(trailingGrace, ENTRIES, 'start')).toBeNull()
  })

  it('连音线延续音：解析为其起始音的条目；缺起始索引 → 无效', () => {
    const cont: HitNote = { noteIndex: 2, measureIndex: 1, endpoint: 'tie-continue', tieStartNoteIndex: 1 }
    expect(resolveEndpoint(cont, ENTRIES, 'start')).toEqual({ startRv: 1.0, endRv: 1.25 })
    const broken: HitNote = { noteIndex: 2, measureIndex: 1, endpoint: 'tie-continue' }
    expect(resolveEndpoint(broken, ENTRIES, 'start')).toBeNull()
  })

  it('空播放数据 → null', () => {
    expect(resolveEndpoint(slot(0), [], 'start')).toBeNull()
  })

  it('dataEndRv = 末条目末刻（audio.md §2.2 规则 7）', () => {
    expect(dataEndRv(ENTRIES)).toBe(2.25)
    expect(dataEndRv([])).toBe(0)
  })
})

describe('createPhraseSelection / createMeasureSelection / createBoxSelection', () => {
  it('乐句乱序自动换位，端点类别随换位搬运', () => {
    const start = slot(6, 2)
    const end: HitNote = { noteIndex: 2, measureIndex: 1, endpoint: 'grace' }
    const selection = createPhraseSelection(start, end)
    expect(selection).toMatchObject({
      kind: 'phrase',
      startIndex: 2,
      endIndex: 6,
      startMeasureIndex: 1,
      endMeasureIndex: 2,
      startEndpoint: 'grace',
      endEndpoint: 'slot',
    })
  })

  it('小节选择 = 该小节占位音符的 noteIndex 包络；无占位（洞小节）→ null', () => {
    const positions = [
      { measureIndex: 0, noteIndex: 0, occupiesSlot: true },
      { measureIndex: 1, noteIndex: 1, occupiesSlot: true },
      { measureIndex: 1, noteIndex: 2, occupiesSlot: true },
      { measureIndex: 2, noteIndex: 3, occupiesSlot: false },
    ]
    expect(createMeasureSelection(1, positions)).toMatchObject({ startIndex: 1, endIndex: 2 })
    expect(createMeasureSelection(9, positions)).toBeNull()
  })

  it('框选选择：区间归一化 + 小节范围取区间内占位音符', () => {
    const positions = [
      { measureIndex: 1, noteIndex: 2, occupiesSlot: true },
      { measureIndex: 2, noteIndex: 3, occupiesSlot: true },
      { measureIndex: 3, noteIndex: 5, occupiesSlot: true },
    ]
    expect(createBoxSelection(5, 2, positions)).toMatchObject({
      kind: 'box',
      startIndex: 2,
      endIndex: 5,
      startMeasureIndex: 1,
      endMeasureIndex: 3,
    })
    expect(createBoxSelection(0, 0, positions)).toBeNull()
  })
})

describe('computeLoopRange（selection.md §2.4 三模式）', () => {
  it('乐句：双端点解析 + skipBeats 透传', () => {
    const selection = createPhraseSelection(slot(1, 1), slot(4, 3))
    expect(computeLoopRange(selection, ENTRIES, 2)).toEqual({
      startRv: 1.0,
      endRv: 2.25,
      skipBeats: 2,
    })
  })

  it('乐句端点含休止：起点取前条目末刻、终点取后条目起刻', () => {
    // 起点 = 曲中休止3（1.75），终点 = 曲尾休止5（曲终 2.25）
    const selection: ScoreSelection = {
      kind: 'phrase',
      startIndex: 3,
      endIndex: 5,
      startMeasureIndex: 2,
      endMeasureIndex: 4,
      startEndpoint: 'slot',
      endEndpoint: 'slot',
    }
    expect(computeLoopRange(selection, ENTRIES, 0)).toEqual({
      startRv: 1.75,
      endRv: 2.25,
      skipBeats: 0,
    })
  })

  it('乐句解析失败（装饰音后无发音）→ null', () => {
    const selection: ScoreSelection = {
      kind: 'phrase',
      startIndex: 1,
      endIndex: 5,
      startMeasureIndex: 1,
      endMeasureIndex: 4,
      startEndpoint: 'slot',
      endEndpoint: 'grace',
    }
    expect(computeLoopRange(selection, ENTRIES, 0)).toBeNull()
  })

  it('小节：按 measureIndex 过滤取首/末条目', () => {
    const selection: ScoreSelection = {
      kind: 'measure',
      startIndex: 1,
      endIndex: 2,
      startMeasureIndex: 1,
      endMeasureIndex: 1,
      startEndpoint: 'slot',
      endEndpoint: 'slot',
    }
    expect(computeLoopRange(selection, ENTRIES, 1)).toEqual({
      startRv: 1.0,
      endRv: 1.75,
      skipBeats: 1,
    })
  })

  it('小节内无发音条目（曲首全休止）：由区间外条目夹出', () => {
    const selection: ScoreSelection = {
      kind: 'measure',
      startIndex: 0,
      endIndex: 0,
      startMeasureIndex: 0,
      endMeasureIndex: 0,
      startEndpoint: 'slot',
      endEndpoint: 'slot',
    }
    expect(computeLoopRange(selection, ENTRIES, 0)).toEqual({
      startRv: 0,
      endRv: 1.0,
      skipBeats: 0,
    })
  })

  it('空播放数据 → null；区间 start ≥ end（−ε）→ null', () => {
    const selection = createMeasureSelection(1, [{ measureIndex: 1, noteIndex: 1, occupiesSlot: true }])
    expect(selection).not.toBeNull()
    expect(computeLoopRange(selection!, [], 0)).toBeNull()
    const degenerate: ScoreSelection = {
      kind: 'phrase',
      startIndex: 0,
      endIndex: 0,
      startMeasureIndex: 0,
      endMeasureIndex: 0,
      startEndpoint: 'slot',
      endEndpoint: 'slot',
    }
    // 单休止号且前后无条目差 → 零长区间
    expect(computeLoopRange(degenerate, [entry(1, 0, 0.25)], 0)).toBeNull()
  })
})

describe('applyBoxModifiers（text-selection.md §3.5）', () => {
  const current: ScoreSelection = {
    kind: 'box',
    startIndex: 4,
    endIndex: 8,
    startMeasureIndex: 1,
    endMeasureIndex: 2,
    startEndpoint: 'slot',
    endEndpoint: 'slot',
  }

  it('无修饰键 = 替换；区间自动归一化', () => {
    expect(
      applyBoxModifiers(current, { startIndex: 9, endIndex: 3 }, { shift: false, ctrlOrMeta: false }),
    ).toEqual({ startIndex: 3, endIndex: 9 })
  })

  it('Shift = 扩展（并集）', () => {
    expect(
      applyBoxModifiers(current, { startIndex: 6, endIndex: 12 }, { shift: true, ctrlOrMeta: false }),
    ).toEqual({ startIndex: 4, endIndex: 12 })
  })

  it('Ctrl/Cmd 重叠 = 裁剪取较长剩余段；全消 → null', () => {
    // 裁掉 4–8 的 6–7：剩 [4,5] 与 [8,8]，取较长 [4,5]
    expect(
      applyBoxModifiers(current, { startIndex: 6, endIndex: 7 }, { shift: false, ctrlOrMeta: true }),
    ).toEqual({ startIndex: 4, endIndex: 5 })
    // 完全覆盖 → null（清除）
    expect(
      applyBoxModifiers(current, { startIndex: 0, endIndex: 20 }, { shift: false, ctrlOrMeta: true }),
    ).toBeNull()
  })

  it('Ctrl/Cmd 不重叠 = 并入', () => {
    expect(
      applyBoxModifiers(current, { startIndex: 10, endIndex: 12 }, { shift: false, ctrlOrMeta: true }),
    ).toEqual({ startIndex: 4, endIndex: 12 })
  })
})

describe('summarizeSelection / describeSelection', () => {
  it('摘要只数占位音符（装饰音/延音延续不计）', () => {
    const positions = [
      { noteIndex: 1, occupiesSlot: true },
      { noteIndex: 1, occupiesSlot: false },
      { noteIndex: 2, occupiesSlot: true },
      { noteIndex: 3, occupiesSlot: true },
    ]
    const selection: ScoreSelection = {
      kind: 'phrase',
      startIndex: 1,
      endIndex: 3,
      startMeasureIndex: 0,
      endMeasureIndex: 1,
      startEndpoint: 'slot',
      endEndpoint: 'slot',
    }
    const summary = summarizeSelection(selection, positions)
    expect(summary).toEqual({ kind: 'phrase', startMeasureIndex: 0, endMeasureIndex: 1, noteCount: 3 })
    expect(describeSelection(enUS, summary)).toBe('Phrase · Measures 1–2 · 3 notes')
  })
})
