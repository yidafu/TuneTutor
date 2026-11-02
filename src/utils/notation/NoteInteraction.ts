/**
 * 音符命中测试与坐标（docs/selection.md §3）。
 * 双索引（决策 S1）：graphicIndex = 图形遍历序（可配对音符序，与 .vf-notehead DOM 序
 * zip 配对；rendersNotehead 判定成员资格）；noteIndex = 复刻 buildPlaybackData 计数
 * （audio.md §2.2/§2.4：装饰音、连音线延续音不占位，休止符与发音音符占位）——与播放
 * 数据同源是硬约束，任何一侧改动计数必须双侧同改 + 重跑计数镜像回归
 * （tests/utils/notation/NoteInteraction.test.ts）。
 * 坐标：屏幕像素唯一来源 getBoundingClientRect（决策 S4）；unit 只经官方公式换算
 * px = unit × 10 × zoom（OSMD issue 504）；禁止读 PositionAndShape.Width/Height。
 * 单声部承诺：产品范围 = 第一声部（staff 0），多声部对齐依赖播放数据演进（§10）。
 */
import type {
  GraphicalMeasure,
  GraphicalMusicSheet,
  GraphicalNote,
  Note,
  OpenSheetMusicDisplay,
  PointF2D,
} from 'opensheetmusicdisplay'
import type { HitNote } from './selection'

export interface NotePosition {
  measureIndex: number
  /** 图形遍历序（可渲染音符内连续；与 DOM 配对序一致） */
  graphicIndex: number
  /** 播放数据索引：装饰音 = 下一占位音，延音延续 = 起始音（selection.md §2.3） */
  noteIndex: number
  /** 容器相对像素（渲染后 rect 缓存，§3.5） */
  x: number
  y: number
  width: number
  height: number
  /** 是否占播放数据位（装饰音/延音延续 false，§2.1） */
  occupiesSlot: boolean
  /** 延音延续音的起始音 noteIndex（endpoint 解析用） */
  tieStartNoteIndex?: number
  /** 渲染行号（0 起连续；行几何见 layout.buildRowGeometries） */
  rowIndex: number
}

/**
 * 计数规则镜像（audio.md §2.4 同源约束的唯一判定）：
 * 装饰音（IsGraceNote）与连音线延续音（有 NoteTie 且非起始音）不占位；
 * 休止符与发音音符占位。src/audio/playbackData.ts（P1）必须复用本判定。
 */
export function occupiesPlaybackSlot(source: Note): boolean {
  if (source.IsGraceNote) return false
  const tie = source.NoteTie
  if (tie !== undefined && tie.StartNote !== source) return false
  return true
}

/**
 * 是否产生 .vf-notehead DOM（graphicIndex 与 DOM zip 配对的成员判定，§3.3 防线 1）。
 * OSMD 1.9.7 实测矩阵（2026-10-28 五谱对账，应用同参数：
 * AutoGenerateMultipleRestMeasuresFromRestMeasures=false + PageBottomMargin=0）：
 * - 发音音符、装饰音、`<rest/>`（含带 `<type>whole` 的全小节休止）：一律产 .vf-notehead
 *   （「世界赠予我的」10 处、「乌兰巴托的夜」6 处，TypeLength=1，图形/DOM 全配平）；
 * - **`<rest measure="yes"/>` 且无 `<type>`**（TypeLength=0）：进图形 staffEntries 但
 *   **不产 .vf-notehead**（「刻在我心底的名字」m34/59/70 三处实测，DOM 45px 内无符头）。
 *   v1.8 曾断言「休止任何编码一律渲染 notehead」，对此编码不成立——三处未排除曾使
 *   防线 1 计数错位 463 vs 460，整谱降级、选择全灭（TC-MAN-02 浏览器取证，2026-10-28）；
 * - PrintObject = false（显式隐藏）：无 DOM，双侧一致；
 * - multirest 折叠杠：无 DOM；应用已关 AutoGenerateMultipleRestMeasures（v1.8），
 *   连续休止小节不会被吞。
 * 只影响 graphicIndex；noteIndex 占位（休止占播放位、光标层照数）不受影响。
 */
export function rendersNotehead(source: Note): boolean {
  if (source.PrintObject === false) return false
  if (source.isRest() && source.TypeLength?.RealValue === 0) return false
  return true
}

/** 与官方命中原语换算同款（OSMD issue 857）：容器相对 px → OSMD unit */
export function pointToUnit(px: number, zoom: number): number {
  return px / 10 / zoom
}

/** px = unit × 10 × zoom（OSMD issue 504） */
export function unitToPx(unit: number, zoom: number): number {
  return unit * 10 * zoom
}

/** 几何自检容差（px，§3.3 防线 2；spike V-S4 实测锚点方差 ±3px） */
const GEOMETRY_TOLERANCE_PX = 5

interface CollectedNote {
  source: GraphicalNote
  measureIndex: number
  graphicIndex: number
  noteIndex: number
  occupiesSlot: boolean
  tieStartNoteIndex?: number
  rowIndex: number
}

/**
 * 图形遍历 → 双索引序列（§3.2）。
 * graphicIndex 只计真正产生 .vf-notehead 的音符（rendersNotehead）：DOM 配对序必须与
 * querySelectorAll('.vf-notehead') 对齐；不渲染音符仍消耗 noteIndex 占位
 * （播放数据经光标层计数，跳过会错位）。
 */
export function collectGraphicNotes(
  measureList: GraphicalMeasure[][],
): { notes: CollectedNote[]; slotCount: number } {
  const notes: CollectedNote[] = []
  const rowIds = new Map<object, number>()
  const tieStartIndexes = new Map<Note, number>()
  let graphicIndex = 0
  let noteIndex = 0
  for (let m = 0; m < measureList.length; m += 1) {
    // 单声部承诺（§2.1）：只遍历 staff 0
    const measure = measureList[m]?.[0]
    if (measure === undefined || measure === null) continue
    let rowIndex = rowIds.get(measure.ParentStaffLine)
    if (rowIndex === undefined) {
      rowIndex = rowIds.size
      rowIds.set(measure.ParentStaffLine, rowIndex)
    }
    for (const staffEntry of measure.staffEntries) {
      for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
        for (const graphicalNote of voiceEntry.notes) {
          const source = graphicalNote.sourceNote
          const occupiesSlot = occupiesPlaybackSlot(source)
          const tie = source.NoteTie
          if (occupiesSlot && tie !== undefined) {
            // 起始音记录自身 noteIndex，供延音延续音回查（S2）
            tieStartIndexes.set(source, noteIndex)
          }
          if (rendersNotehead(source)) {
            notes.push({
              source: graphicalNote,
              measureIndex: m,
              graphicIndex,
              noteIndex: occupiesSlot
                ? noteIndex
                : tie !== undefined
                  ? tieStartIndexes.get(tie.StartNote) ?? noteIndex
                  : noteIndex,
              occupiesSlot,
              tieStartNoteIndex:
                !occupiesSlot && tie !== undefined
                  ? tieStartIndexes.get(tie.StartNote)
                  : undefined,
              rowIndex,
            })
            graphicIndex += 1
          }
          if (occupiesSlot) noteIndex += 1
        }
      }
    }
  }
  return { notes, slotCount: noteIndex }
}

/** zip + 计数守卫（§3.3 防线 1）：两侧数量不等即整条放弃，由调用方降级 */
export function zipNotesWithElements(
  notes: readonly CollectedNote[],
  elements: readonly Element[],
): Array<{ note: CollectedNote; element: Element }> | null {
  if (notes.length !== elements.length) return null
  return notes.map((note, i) => ({ note, element: elements[i]! }))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 几何自检（§3.3 防线 2）：元素 rect 与 PAS AbsolutePosition × 10 × zoom 的仿射
 * 关系应成立（V-S4）；以中位偏移为标定（容器 padding，≈ −6px 实测），偏离超容差的
 * 配对剔除。标定按字形类（休止/音符）分别计算：休止字形 bbox 相对 PAS 的 y 偏移
 * 与音符相差 ≈6.7px（《刻》谱实测休止 dy ∈ [0.1,1.5] vs 音符 −5.2），混合中位数
 * 会把少数类整类误杀——超容差剔除只应命中个体漂移（v1.9）。
 */
export function checkPairingGeometry(
  pairs: ReadonlyArray<{ note: CollectedNote; element: Element }>,
  zoom: number,
  containerRect: RectLike,
): Array<{ note: CollectedNote; element: Element }> {
  const measured = pairs.map((pair) => {
    const rect = pair.element.getBoundingClientRect()
    const absolute = pair.note.source.PositionAndShape.AbsolutePosition
    return {
      pair,
      rest: pair.note.source.sourceNote.isRest(),
      rect: { x: rect.x - containerRect.x, y: rect.y - containerRect.y, width: rect.width, height: rect.height },
      expectedX: unitToPx(absolute.x, zoom),
      expectedY: unitToPx(absolute.y, zoom),
    }
  })
  const calibrate = (selected: typeof measured, fallback: typeof measured) => {
    const source = selected.length > 0 ? selected : fallback
    return {
      offsetX: median(source.map((m) => m.rect.x - m.expectedX)),
      offsetY: median(source.map((m) => m.rect.y - m.expectedY)),
    }
  }
  const noteOffset = calibrate(
    measured.filter((m) => !m.rest),
    measured,
  )
  const restOffset = calibrate(
    measured.filter((m) => m.rest),
    measured,
  )
  return measured
    .filter((m) => {
      const { offsetX, offsetY } = m.rest ? restOffset : noteOffset
      return (
        Math.abs(m.rect.x - m.expectedX - offsetX) <= GEOMETRY_TOLERANCE_PX &&
        Math.abs(m.rect.y - m.expectedY - offsetY) <= GEOMETRY_TOLERANCE_PX
      )
    })
    .map((m) => m.pair)
}

export interface NoteBuildResult {
  positions: NotePosition[]
  /** 计数守卫失败（DOM 洞超出防线 1 假设）：走命中回落路径 */
  degraded: boolean
}

/**
 * 渲染后构建一次、缓存至下次渲染（§3.2）：遍历 → DOM 配对 → 几何自检 → rect 缓存。
 * OSMD clear()/重渲染/缩放后必须重新 build（缓存全量失效，tech.md §6.1）。
 */
export class NoteInteraction {
  private readonly osmd: OpenSheetMusicDisplay
  private readonly container: HTMLElement
  private positions: NotePosition[] = []
  private readonly elementToPosition = new Map<Element, NotePosition>()
  private readonly graphicToPosition = new Map<GraphicalNote, NotePosition>()
  private degraded = false

  constructor(osmd: OpenSheetMusicDisplay, container: HTMLElement) {
    this.osmd = osmd
    this.container = container
  }

  get isDegraded(): boolean {
    return this.degraded
  }

  build(): NoteBuildResult {
    this.positions = []
    this.elementToPosition.clear()
    this.graphicToPosition.clear()
    this.degraded = false

    // 测试替身/异常环境下 osmd 可能不完整：缺 GraphicSheet 即降级（缓存空、命中回落）
    const sheet = (
      this.osmd as unknown as { GraphicSheet?: GraphicalMusicSheet } | undefined | null
    )?.GraphicSheet
    if (sheet === undefined || sheet === null) return { positions: [], degraded: true }

    const { notes } = collectGraphicNotes(sheet.MeasureList)
    const elements = Array.from(this.container.querySelectorAll('.vf-notehead'))
    const zoom = this.osmd.zoom
    const containerRect = this.container.getBoundingClientRect()

    let pairs = zipNotesWithElements(notes, elements)
    if (pairs === null) {
      // 计数守卫失败（V-S3 洞）：整条放弃 zip，降级为无 DOM 配对（§3.3）
      this.degraded = true
      pairs = []
    } else {
      pairs = checkPairingGeometry(pairs, zoom, containerRect)
    }

    for (const { note, element } of pairs) {
      const rect = element.getBoundingClientRect()
      const position: NotePosition = {
        measureIndex: note.measureIndex,
        graphicIndex: note.graphicIndex,
        noteIndex: note.noteIndex,
        x: rect.x - containerRect.x,
        y: rect.y - containerRect.y,
        width: rect.width,
        height: rect.height,
        occupiesSlot: note.occupiesSlot,
        tieStartNoteIndex: note.tieStartNoteIndex,
        rowIndex: note.rowIndex,
      }
      this.positions.push(position)
      this.elementToPosition.set(element, position)
      this.graphicToPosition.set(note.source, position)
    }
    return { positions: this.positions, degraded: this.degraded }
  }

  get cachedPositions(): readonly NotePosition[] {
    return this.positions
  }

  positionForElement(element: Element): NotePosition | null {
    return this.elementToPosition.get(element) ?? null
  }

  /**
   * 指针路由命中（§3.4 前两层）：closest 主路径 → elementsFromPoint 辅。
   * 不做最近邻吸附——空白必须能成为框选入口（音符吸附是 §10 后续候选）；
   * 最近邻回落仅用于句柄微调（hitAtPoint）。
   */
  hitFromEvent(event: { target: EventTarget | null; clientX: number; clientY: number }): NotePosition | null {
    const target = event.target
    if (!(target instanceof Element)) return null
    const notehead = target.closest('.vf-notehead')
    if (notehead === null) return null
    return this.elementToPosition.get(notehead) ?? null
  }

  /** 完整命中链（§3.4 三层）：elementsFromPoint → GetNearestNote 回落；空白 = null */
  hitAtPoint(clientX: number, clientY: number): NotePosition | null {
    if (typeof document.elementsFromPoint === 'function') {
      for (const element of document.elementsFromPoint(clientX, clientY)) {
        if (!(element instanceof Element)) continue
        const notehead = element.closest('.vf-notehead')
        if (notehead === null) continue
        const position = this.elementToPosition.get(notehead)
        if (position !== undefined) return position
      }
    }
    return this.nearestAtPoint(clientX, clientY)
  }

  /** 回落路径（§3.3 防线 3）：px ÷ 10 ÷ zoom → 官方 GetNearestNote（V-S5：1.9.7 可用） */
  nearestAtPoint(clientX: number, clientY: number): NotePosition | null {
    const sheet = (
      this.osmd as unknown as { GraphicSheet?: GraphicalMusicSheet } | undefined | null
    )?.GraphicSheet
    if (sheet === undefined || typeof sheet.GetNearestNote !== 'function') return null
    try {
      const containerRect = this.container.getBoundingClientRect()
      const unitX = pointToUnit(clientX - containerRect.x, this.osmd.zoom)
      const unitY = pointToUnit(clientY - containerRect.y, this.osmd.zoom)
      const nearest = sheet.GetNearestNote(
        { x: unitX, y: unitY } as PointF2D,
        { x: 5, y: 10 } as PointF2D,
      )
      return nearest === null ? null : this.graphicToPosition.get(nearest) ?? null
    } catch {
      return null
    }
  }
}

/** NotePosition → 命中视图（选择域端点解析入参） */
export function hitNoteFromPosition(position: NotePosition): HitNote {
  return {
    noteIndex: position.noteIndex,
    measureIndex: position.measureIndex,
    endpoint: position.occupiesSlot
      ? 'slot'
      : position.tieStartNoteIndex !== undefined
        ? 'tie-continue'
        : 'grace',
    tieStartNoteIndex: position.tieStartNoteIndex,
  }
}
