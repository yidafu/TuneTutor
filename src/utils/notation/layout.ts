/**
 * 行/坐标几何工具（docs/features/text-selection.md §4、docs/selection.md §3.5）。
 * 全部坐标为容器相对像素（决策 S4：屏幕像素唯一来源 getBoundingClientRect，
 * 在 NoteInteraction 构建时缓存）；行几何由 OSMD 实际换行推导，不自定布局。
 * 纯函数：输入 positions/rows 缓存，输出矩形，供覆盖层渲染与框选命中。
 */
import type { NotePosition } from './NoteInteraction'
import { normalizeRange } from './selection'

/** 行外接框（容器坐标），由该行音符 rect 外扩一档得出 */
export interface RowGeometry {
  rowIndex: number
  startMeasureIndex: number
  endMeasureIndex: number
  y: number
  height: number
  /** 行内容水平范围（首音符左缘 → 末音符右缘） */
  left: number
  right: number
}

/** 行带上下外扩（px）：容纳符干/连音线，让拖拽命中与高亮不贴谱线 */
export const ROW_PAD_PX = 12

/** 行内高亮矩形（覆盖层渲染；跨行高亮的分片绘制模式，text-selection.md §4） */
export interface RowHighlightRect {
  rowIndex: number
  x1: number
  x2: number
  y: number
  height: number
  isStartRow: boolean
  isEndRow: boolean
}

/** 按渲染行分组推导行几何；rowIndex 必须已由 NoteInteraction 分配（0 起连续） */
export function buildRowGeometries(positions: readonly NotePosition[]): RowGeometry[] {
  const groups = new Map<number, NotePosition[]>()
  for (const p of positions) {
    const group = groups.get(p.rowIndex)
    if (group === undefined) groups.set(p.rowIndex, [p])
    else group.push(p)
  }
  const rows: RowGeometry[] = []
  for (const [rowIndex, group] of groups) {
    let y = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let startMeasure = Number.POSITIVE_INFINITY
    let endMeasure = Number.NEGATIVE_INFINITY
    for (const p of group) {
      y = Math.min(y, p.y)
      bottom = Math.max(bottom, p.y + p.height)
      left = Math.min(left, p.x)
      right = Math.max(right, p.x + p.width)
      startMeasure = Math.min(startMeasure, p.measureIndex)
      endMeasure = Math.max(endMeasure, p.measureIndex)
    }
    rows.push({
      rowIndex,
      startMeasureIndex: startMeasure,
      endMeasureIndex: endMeasure,
      y: y - ROW_PAD_PX,
      height: bottom - y + ROW_PAD_PX * 2,
      left,
      right,
    })
  }
  return rows.sort((a, b) => a.rowIndex - b.rowIndex)
}

/**
 * 选择 → 每行高亮矩形。首/末行取区间内音符的水平包络，
 * 中间行整行（罕见：中间行全部音符不可见的洞情形）。
 */
export function computeRowHighlights(
  selection: { startIndex: number; endIndex: number },
  positions: readonly NotePosition[],
  rows: readonly RowGeometry[],
): RowHighlightRect[] {
  const rowByIndex = new Map(rows.map((r) => [r.rowIndex, r]))
  const bounds = new Map<number, { x1: number; x2: number }>()
  for (const p of positions) {
    if (!p.occupiesSlot || p.noteIndex < selection.startIndex || p.noteIndex > selection.endIndex) {
      continue
    }
    const current = bounds.get(p.rowIndex)
    if (current === undefined) {
      bounds.set(p.rowIndex, { x1: p.x, x2: p.x + p.width })
    } else {
      current.x1 = Math.min(current.x1, p.x)
      current.x2 = Math.max(current.x2, p.x + p.width)
    }
  }
  const startRow = startRowIndexOf(selection.startIndex, positions)
  const endRow = startRowIndexOf(selection.endIndex, positions)
  const highlights: RowHighlightRect[] = []
  for (const [rowIndex, bound] of bounds) {
    const row = rowByIndex.get(rowIndex)
    if (row === undefined) continue
    highlights.push({
      rowIndex,
      x1: bound.x1,
      x2: bound.x2,
      y: row.y,
      height: row.height,
      isStartRow: rowIndex === startRow,
      isEndRow: rowIndex === endRow,
    })
  }
  // 补中间无音符的行（整行高亮，保持跨行视觉连续）
  if (startRow >= 0 && endRow >= 0) {
    for (const row of rows) {
      if (row.rowIndex <= startRow || row.rowIndex >= endRow || bounds.has(row.rowIndex)) continue
      highlights.push({
        rowIndex: row.rowIndex,
        x1: row.left,
        x2: row.right,
        y: row.y,
        height: row.height,
        isStartRow: false,
        isEndRow: false,
      })
    }
  }
  return highlights.sort((a, b) => a.rowIndex - b.rowIndex)
}

function startRowIndexOf(noteIndex: number, positions: readonly NotePosition[]): number {
  const p = positions.find((cand) => cand.occupiesSlot && cand.noteIndex === noteIndex)
  return p === undefined ? -1 : p.rowIndex
}

export interface DragRect {
  /** 容器相对像素，已归一化（x1 ≤ x2, y1 ≤ y2） */
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * 拖拽矩形 → 连续 noteIndex 区间（text-selection.md §3.2）：
 * 矩形纵向覆盖的行参与；首/末行按横向范围截取（反向拖拽经归一化自动成立），
 * 中间行整行计入。一个音符都没盖到 → null（不产生选择）。
 */
export function computeBoxSelection(
  rect: DragRect,
  positions: readonly NotePosition[],
  rows: readonly RowGeometry[],
): { startIndex: number; endIndex: number } | null {
  // 防御性归一化（反向拖拽 = x1 > x2，OsmdNotation 的 localRect 已归一化，此处兜底）
  const x1 = Math.min(rect.x1, rect.x2)
  const x2 = Math.max(rect.x1, rect.x2)
  const y1 = Math.min(rect.y1, rect.y2)
  const y2 = Math.max(rect.y1, rect.y2)
  const rowByIndex = new Map(rows.map((r) => [r.rowIndex, r]))
  const overlappedRows = rows.filter((row) => row.y < y2 && row.y + row.height > y1)
  if (overlappedRows.length === 0) return null
  const overlapped = new Set(overlappedRows.map((row) => row.rowIndex))
  let startIndex = Number.POSITIVE_INFINITY
  let endIndex = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (!p.occupiesSlot || !overlapped.has(p.rowIndex)) continue
    const row = rowByIndex.get(p.rowIndex)
    if (row === undefined) continue
    const isFirstRow = row.rowIndex === overlappedRows[0]!.rowIndex
    const isLastRow = row.rowIndex === overlappedRows[overlappedRows.length - 1]!.rowIndex
    const centerX = p.x + p.width / 2
    if (isFirstRow && centerX < x1) continue
    if (isLastRow && centerX > x2) continue
    startIndex = Math.min(startIndex, p.noteIndex)
    endIndex = Math.max(endIndex, p.noteIndex)
  }
  if (startIndex === Number.POSITIVE_INFINITY) return null
  return normalizeRange(startIndex, endIndex)
}