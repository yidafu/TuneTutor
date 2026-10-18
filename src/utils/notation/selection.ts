/**
 * 选择域纯函数：选择产物、端点解析、LoopRange 推导（docs/selection.md §2，决策 S2/S8）。
 * LoopRange 一律由本模块推导，组件禁止自算（§6 硬规则 4）；
 * 时间为乐谱时域 RealValue（tech.md §3），与 BPM 无关，RealValue 域比较容差 1e-4（audio.md §2.5）。
 */
import type { LoopRange, PlaybackEntry } from '../../types/playback'
import type { TranslationSet } from '../../locales/en-US'

/** RealValue 域时间比较容差（audio.md §2.5，决策 A10；禁止裸 ===/<） */
export const RV_EPSILON = 1e-4

/** 拖拽起板阈值（px）：与 ProseMirror 同款，低于它视为单击（selection.md §4.2） */
export const DRAG_SLOP_PX = 4

/** pending 起点延迟销毁窗口（ms）：对齐 Chrome 原生双击阈值（selection.md §4.3） */
export const PENDING_DESTROY_MS = 500

export type SelectionKind = 'phrase' | 'measure' | 'box'

/** 会话态选择产物（决策 S8：不持久化）；noteIndex 为全曲连续索引（含休止占位） */
export interface ScoreSelection {
  kind: SelectionKind
  /** 含端点；start ≤ end（创建函数负责归一化换位） */
  startIndex: number
  endIndex: number
  /** 0 起小节索引，含端点 */
  startMeasureIndex: number
  endMeasureIndex: number
  /** 端点类别（端点解析 §2.3 需要）；measure/box 两端恒为 slot */
  startEndpoint: EndpointKind
  endEndpoint: EndpointKind
  /** 端点为 tie-continue 时指向其连结线起始音的 noteIndex */
  startTieSourceIndex?: number
  endTieSourceIndex?: number
}

export type EndpointKind = 'slot' | 'grace' | 'tie-continue'

/** 命中层交给选择的音符视图（NoteInteraction 产出 NotePosition 后映射） */
export interface HitNote {
  noteIndex: number
  measureIndex: number
  endpoint: EndpointKind
  tieStartNoteIndex?: number
}

export function normalizeRange(a: number, b: number): { startIndex: number; endIndex: number } {
  return a <= b ? { startIndex: a, endIndex: b } : { startIndex: b, endIndex: a }
}

/** 双击两端点 → 乐句选择；乱序自动换位（tech.md §6.2） */
export function createPhraseSelection(start: HitNote, end: HitNote): ScoreSelection {
  const { startIndex, endIndex } = normalizeRange(start.noteIndex, end.noteIndex)
  const first = start.noteIndex <= end.noteIndex ? start : end
  const second = start.noteIndex <= end.noteIndex ? end : start
  return {
    kind: 'phrase',
    startIndex,
    endIndex,
    startMeasureIndex: Math.min(first.measureIndex, second.measureIndex),
    endMeasureIndex: Math.max(first.measureIndex, second.measureIndex),
    startEndpoint: first.endpoint,
    endEndpoint: second.endpoint,
    startTieSourceIndex: first.tieStartNoteIndex,
    endTieSourceIndex: second.tieStartNoteIndex,
  }
}

/** 单击 → 所在小节；该小节无可定位音符（洞小节且无落点）时返回 null（无效选择） */
export function createMeasureSelection(
  measureIndex: number,
  positions: ReadonlyArray<{ measureIndex: number; noteIndex: number; occupiesSlot: boolean }>,
): ScoreSelection | null {
  const indexes = positions
    .filter((p) => p.occupiesSlot && p.measureIndex === measureIndex)
    .map((p) => p.noteIndex)
  if (indexes.length === 0) return null
  return {
    kind: 'measure',
    startIndex: Math.min(...indexes),
    endIndex: Math.max(...indexes),
    startMeasureIndex: measureIndex,
    endMeasureIndex: measureIndex,
    startEndpoint: 'slot',
    endEndpoint: 'slot',
  }
}

/** 框选 → 连续 noteIndex 区间；量测小节范围取区间内占位音符（positions 同源缓存） */
export function createBoxSelection(
  startIndex: number,
  endIndex: number,
  positions: ReadonlyArray<{ measureIndex: number; noteIndex: number; occupiesSlot: boolean }>,
): ScoreSelection | null {
  const range = normalizeRange(startIndex, endIndex)
  let minMeasure = Number.POSITIVE_INFINITY
  let maxMeasure = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (!p.occupiesSlot || p.noteIndex < range.startIndex || p.noteIndex > range.endIndex) continue
    minMeasure = Math.min(minMeasure, p.measureIndex)
    maxMeasure = Math.max(maxMeasure, p.measureIndex)
  }
  if (minMeasure === Number.POSITIVE_INFINITY) return null
  return {
    kind: 'box',
    startIndex: range.startIndex,
    endIndex: range.endIndex,
    startMeasureIndex: minMeasure,
    endMeasureIndex: maxMeasure,
    startEndpoint: 'slot',
    endEndpoint: 'slot',
  }
}

// ── 端点解析（selection.md §2.3，决策 S2）──────────────────────────────

export interface ResolvedEndpoint {
  startRv: number
  endRv: number
}

export type EndpointRole = 'start' | 'end'

/** 二分找首个 noteIndex ≥ 给定值的条目，返回下标；无则 entries.length */
function findIndexAtOrAfter(entries: readonly PlaybackEntry[], noteIndex: number): number {
  let lo = 0
  let hi = entries.length - 1
  let result = entries.length
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const entry = entries[mid]!
    if (entry.noteIndex >= noteIndex) {
      result = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return result
}

/**
 * noteIndex 组跨度（audio.md §2.2-8/9 决策 A17）：倚音与装饰音切片子条目共享主音
 * noteIndex，区间 = 首条目起刻到末条目末刻（循环终点不会砍掉主音尾）。
 */
function groupInterval(
  entries: readonly PlaybackEntry[],
  noteIndex: number,
): ResolvedEndpoint | null {
  const firstIndex = findIndexAtOrAfter(entries, noteIndex)
  const first = entries[firstIndex]
  if (first === undefined || first.noteIndex !== noteIndex) return null
  let lastIndex = firstIndex
  while (
    lastIndex + 1 < entries.length &&
    entries[lastIndex + 1]!.noteIndex === noteIndex
  ) {
    lastIndex += 1
  }
  const last = entries[lastIndex]!
  return { startRv: first.startRv, endRv: last.startRv + last.durationRv }
}

function entryInterval(entry: PlaybackEntry): ResolvedEndpoint {
  return { startRv: entry.startRv, endRv: entry.startRv + entry.durationRv }
}

/** 数据终点 = 末条目末刻（audio.md §2.2 规则 7：等最后一音播完） */
export function dataEndRv(entries: readonly PlaybackEntry[]): number {
  const last = entries[entries.length - 1]
  return last === undefined ? 0 : last.startRv + last.durationRv
}

/**
 * 音符 → 播放数据端点区间。四类规则（§2.3）：
 * 发音 = 同 noteIndex 组跨度（倚音/装饰音切片与主音同组，A17）；休止 = [前条目末刻,
 * 后条目起刻]（曲端取 0/曲终）；装饰音 = 所在组（下一占位音的组）；连音线延续音 = 其起始音。
 * role 只影响调用方取区间哪一侧（起点取 startRv，终点取 endRv），区间本身一致。
 */
export function resolveEndpoint(
  note: HitNote,
  entries: readonly PlaybackEntry[],
  _role: EndpointRole,
): ResolvedEndpoint | null {
  if (note.endpoint === 'tie-continue') {
    if (note.tieStartNoteIndex === undefined) return null
    return resolveEndpoint(
      { noteIndex: note.tieStartNoteIndex, measureIndex: note.measureIndex, endpoint: 'slot' },
      entries,
      _role,
    )
  }
  if (entries.length === 0) return null
  if (note.endpoint === 'grace') {
    // 装饰音端点：宿主组跨度；宿主为休止占位（组不存在）时回落到下一发音条目
    const index = findIndexAtOrAfter(entries, note.noteIndex)
    const first = entries[index]
    if (first === undefined) return null
    if (first.noteIndex === note.noteIndex) return groupInterval(entries, note.noteIndex)
    return entryInterval(first)
  }
  // 发音端点：同 noteIndex 组跨度（倚音/装饰音切片与主音同组，A17）
  const group = groupInterval(entries, note.noteIndex)
  if (group !== null) return group
  // 休止符：播放数据无该条目，由相邻条目夹出区间
  const afterIndex = findIndexAtOrAfter(entries, note.noteIndex)
  const before = afterIndex > 0 ? entries[afterIndex - 1] : undefined
  const after = entries[afterIndex]
  return {
    startRv: before === undefined ? 0 : before.startRv + before.durationRv,
    endRv: after === undefined ? dataEndRv(entries) : after.startRv,
  }
}

// ── LoopRange 推导（selection.md §2.4，唯一入口）──────────────────────

function computeMeasureRange(
  startMeasureIndex: number,
  endMeasureIndex: number,
  entries: readonly PlaybackEntry[],
): ResolvedEndpoint | null {
  const inside = entries.filter(
    (e) => e.measureIndex >= startMeasureIndex && e.measureIndex <= endMeasureIndex,
  )
  if (inside.length > 0) {
    const first = inside[0]!
    const last = inside[inside.length - 1]!
    return { startRv: first.startRv, endRv: last.startRv + last.durationRv }
  }
  // 区间内无发音条目（如曲首全休止小节，spike V6）：由区间外条目夹出
  const before = entries.filter((e) => e.measureIndex < startMeasureIndex)
  const after = entries.filter((e) => e.measureIndex > endMeasureIndex)
  const startRv =
    before.length === 0 ? 0 : before[before.length - 1]!.startRv + before[before.length - 1]!.durationRv
  const endRv = after.length === 0 ? dataEndRv(entries) : after[0]!.startRv
  return { startRv, endRv }
}

/**
 * 选择 → LoopRange（乐谱时域，BPM 无关）。三种模式（§2.4）：
 * 乐句/框选 = 双端点解析；小节 = 按 measureIndex 过滤播放数据取首/末条目。
 * 解析失败或区间 start ≥ end（−ε）→ null（本次选择无效，UI 提示走 i18n）。
 */
export function computeLoopRange(
  selection: ScoreSelection,
  entries: readonly PlaybackEntry[],
  skipBeats: number,
): LoopRange | null {
  if (entries.length === 0) return null
  let resolved: ResolvedEndpoint | null
  if (selection.kind === 'measure') {
    resolved = computeMeasureRange(selection.startMeasureIndex, selection.endMeasureIndex, entries)
  } else {
    const start = resolveEndpoint(
      {
        noteIndex: selection.startIndex,
        measureIndex: selection.startMeasureIndex,
        endpoint: selection.startEndpoint,
        tieStartNoteIndex: selection.startTieSourceIndex,
      },
      entries,
      'start',
    )
    const end = resolveEndpoint(
      {
        noteIndex: selection.endIndex,
        measureIndex: selection.endMeasureIndex,
        endpoint: selection.endEndpoint,
        tieStartNoteIndex: selection.endTieSourceIndex,
      },
      entries,
      'end',
    )
    resolved = start === null || end === null ? null : { startRv: start.startRv, endRv: end.endRv }
  }
  if (resolved === null || resolved.endRv - resolved.startRv <= RV_EPSILON) return null
  return { startRv: resolved.startRv, endRv: resolved.endRv, skipBeats }
}

// ── 展示摘要与框选修饰键 ──────────────────────────────────────────────

export interface SelectionSummary {
  kind: SelectionKind
  startMeasureIndex: number
  endMeasureIndex: number
  /** 区间内占位音符数（装饰音/延音延续不计，§2.1） */
  noteCount: number
}

export function summarizeSelection(
  selection: ScoreSelection,
  positions: ReadonlyArray<{ noteIndex: number; occupiesSlot: boolean }>,
): SelectionSummary {
  let noteCount = 0
  for (const p of positions) {
    if (p.occupiesSlot && p.noteIndex >= selection.startIndex && p.noteIndex <= selection.endIndex) {
      noteCount += 1
    }
  }
  return {
    kind: selection.kind,
    startMeasureIndex: selection.startMeasureIndex,
    endMeasureIndex: selection.endMeasureIndex,
    noteCount,
  }
}

/**
 * 框选修饰键（features/text-selection.md §3.5）：
 * Shift = 扩展（并集）；Ctrl/Cmd = 切换——重叠则裁剪（取较长剩余段，全消则 null），不重叠则并入。
 * 单区间 LoopRange 模型下 toggle 的裁剪语义是文档化的近似（selection.md v1.4）。
 */
export function applyBoxModifiers(
  current: ScoreSelection | null,
  box: { startIndex: number; endIndex: number },
  modifiers: { shift: boolean; ctrlOrMeta: boolean },
): { startIndex: number; endIndex: number } | null {
  const range = normalizeRange(box.startIndex, box.endIndex)
  if (current === null || (!modifiers.shift && !modifiers.ctrlOrMeta)) return range
  const extended = {
    startIndex: Math.min(current.startIndex, range.startIndex),
    endIndex: Math.max(current.endIndex, range.endIndex),
  }
  if (modifiers.shift || current.endIndex < range.startIndex || range.endIndex < current.startIndex) {
    return extended
  }
  // toggle：重叠 → 裁剪出剩余段，取较长一段
  const lower = { startIndex: current.startIndex, endIndex: range.startIndex - 1 }
  const upper = { startIndex: range.endIndex + 1, endIndex: current.endIndex }
  const lowerValid = lower.endIndex >= lower.startIndex
  const upperValid = upper.endIndex >= upper.startIndex
  if (!lowerValid && !upperValid) return null
  if (!lowerValid) return upper
  if (!upperValid) return lower
  return lower.endIndex - lower.startIndex >= upper.endIndex - upper.startIndex ? lower : upper
}

/** 摘要文案（chip/状态栏共用）：`乐句 · 第 5 – 8 小节 · 14 个音符`（ui-design.html v3） */
export function describeSelection(
  t: Pick<
    TranslationSet,
    'selectionPhrase' | 'selectionMeasure' | 'selectionBox' | 'selectionMeasures' | 'selectionNoteCount'
  >,
  summary: SelectionSummary,
): string {
  const kind =
    summary.kind === 'phrase'
      ? t.selectionPhrase
      : summary.kind === 'measure'
        ? t.selectionMeasure
        : t.selectionBox
  const measures = t.selectionMeasures(summary.startMeasureIndex + 1, summary.endMeasureIndex + 1)
  return `${kind} · ${measures} · ${t.selectionNoteCount(summary.noteCount)}`
}
