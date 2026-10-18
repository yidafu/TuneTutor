import { describe, expect, it } from 'vitest'

import {
  buildRowGeometries,
  computeBoxSelection,
  computeRowHighlights,
  ROW_PAD_PX,
  type DragRect,
} from '@/utils/notation/layout'
import type { NotePosition } from '@/utils/notation/NoteInteraction'

function note(fields: Partial<NotePosition> & { noteIndex: number }): NotePosition {
  return {
    measureIndex: 0,
    graphicIndex: fields.noteIndex,
    x: 0,
    y: 0,
    width: 12,
    height: 10,
    occupiesSlot: true,
    rowIndex: 0,
    ...fields,
  }
}

/** 两行样例：行0 = 音符0–2（小节0–1），行1 = 音符3–4（小节2） */
const POSITIONS: NotePosition[] = [
  note({ noteIndex: 0, measureIndex: 0, x: 60, y: 40, rowIndex: 0 }),
  note({ noteIndex: 1, measureIndex: 1, x: 120, y: 52, rowIndex: 0 }),
  note({ noteIndex: 2, measureIndex: 1, x: 180, y: 40, rowIndex: 0 }),
  note({ noteIndex: 3, measureIndex: 2, x: 60, y: 180, rowIndex: 1 }),
  note({ noteIndex: 4, measureIndex: 2, x: 120, y: 180, rowIndex: 1 }),
]

const ROWS = buildRowGeometries(POSITIONS)

describe('buildRowGeometries（行几何由 OSMD 换行推导）', () => {
  it('按行分组：外接框带 padding，行号升序', () => {
    expect(ROWS).toHaveLength(2)
    expect(ROWS[0]).toMatchObject({
      rowIndex: 0,
      startMeasureIndex: 0,
      endMeasureIndex: 1,
      y: 40 - ROW_PAD_PX,
      left: 60,
      right: 192,
    })
    expect(ROWS[0]!.height).toBe(62 - 40 + ROW_PAD_PX * 2)
    expect(ROWS[1]).toMatchObject({ rowIndex: 1, startMeasureIndex: 2, endMeasureIndex: 2 })
  })
})

describe('computeRowHighlights（每行分片矩形）', () => {
  it('首/末行取音符水平包络并带 isStartRow/isEndRow 旗标', () => {
    const rects = computeRowHighlights({ startIndex: 1, endIndex: 4 }, POSITIONS, ROWS)
    expect(rects).toHaveLength(2)
    expect(rects[0]).toMatchObject({
      rowIndex: 0,
      x1: 120,
      x2: 192,
      isStartRow: true,
      isEndRow: false,
    })
    expect(rects[1]).toMatchObject({
      rowIndex: 1,
      x1: 60,
      x2: 132,
      isStartRow: false,
      isEndRow: true,
    })
  })

  it('跨行区间补中间无占位音符的行（整行高亮，保持视觉连续）', () => {
    // 中间行只有装饰音（不占位、不入选）→ 几何整行补齐
    const sparse: NotePosition[] = [
      note({ noteIndex: 0, measureIndex: 0, x: 60, y: 40, rowIndex: 0 }),
      note({ noteIndex: 1, measureIndex: 0, x: 120, y: 40, rowIndex: 0 }),
      note({ noteIndex: 2, measureIndex: 1, x: 60, y: 180, rowIndex: 1, occupiesSlot: false }),
      note({ noteIndex: 2, measureIndex: 1, x: 120, y: 180, rowIndex: 1, occupiesSlot: false }),
      note({ noteIndex: 2, measureIndex: 2, x: 60, y: 320, rowIndex: 2 }),
    ]
    const rows = buildRowGeometries(sparse)
    const rects = computeRowHighlights({ startIndex: 0, endIndex: 2 }, sparse, rows)
    expect(rects.map((r) => r.rowIndex)).toEqual([0, 1, 2])
    const middle = rects.find((r) => r.rowIndex === 1)!
    expect(middle.isStartRow).toBe(false)
    expect(middle.isEndRow).toBe(false)
    expect(middle.x1).toBe(rows[1]!.left)
    expect(middle.x2).toBe(rows[1]!.right)
  })
})

describe('computeBoxSelection（拖拽矩形 → noteIndex 区间）', () => {
  const rect = (x1: number, y1: number, x2: number, y2: number): DragRect => ({ x1, y1, x2, y2 })

  it('单行内正向拖拽：按行带纵向覆盖 + 横向范围截取', () => {
    expect(computeBoxSelection(rect(100, 30, 200, 60), POSITIONS, ROWS)).toEqual({
      startIndex: 1,
      endIndex: 2,
    })
  })

  it('反向拖拽归一化成立', () => {
    expect(computeBoxSelection(rect(200, 30, 100, 60), POSITIONS, ROWS)).toEqual({
      startIndex: 1,
      endIndex: 2,
    })
  })

  it('跨行拖拽：首行截左、末行截右、中间行整行', () => {
    // 纵向条带（x=100）：行0 取右半（≥100），行1 取左半（≤100）
    expect(computeBoxSelection(rect(100, 30, 100, 200), POSITIONS, ROWS)).toEqual({
      startIndex: 1,
      endIndex: 3,
    })
  })

  it('没盖到任何音符 → null（不产生选择）', () => {
    // 行带之外（row0 带始于 y=28）
    expect(computeBoxSelection(rect(0, 0, 10, 10), POSITIONS, ROWS)).toBeNull()
    // 只盖到 row0 且横向在其音符右侧：首行无音符 ≥ x1 → 无选择
    expect(computeBoxSelection(rect(600, 30, 700, 60), POSITIONS, ROWS)).toBeNull()
  })
})
