import { vi } from 'vitest'

/**
 * OSMD 测试替身（jsdom 无 SVG 布局）：按规格构建图形结构 + `.vf-notehead` DOM，
 * rect 用 defineProperty 钉值（AGENTS 基建约定）。用于 OsmdNotation / ScorePage 测试，
 * 经 vi.mock 替换 `@/utils/notation/OsmdRender` 的 OsmdRender 类（nextZoomStep 等保留真实实现）。
 */

export interface FakeNoteSpec {
  /** 音符头 rect 左缘（容器相对 px） */
  x: number
  y: number
  width?: number
  height?: number
  isGrace?: boolean
  /** 连结线角色：start 建立新 tie，continue 接最近一个 start */
  tie?: 'start' | 'continue'
  /** false = 不可渲染（PrintObject=false，不产生 DOM 但占 noteIndex） */
  printObject?: false
}

export interface FakeScoreSpec {
  /** measures[m].row 相同值共享同一 ParentStaffLine（= 同一渲染行） */
  measures: Array<{ row?: number; notes: FakeNoteSpec[] }>
}

export interface FakeRect {
  x: number
  y: number
  width: number
  height: number
}

/** 容器 rect 钉值（容器相对坐标换算基准） */
export const FAKE_CONTAINER_RECT: FakeRect = { x: 20, y: 10, width: 1000, height: 400 }

interface TieLike {
  StartNote: Record<string, unknown>
}

function stubRect(element: Element, rect: FakeRect): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: FAKE_CONTAINER_RECT.x + rect.x,
      y: FAKE_CONTAINER_RECT.y + rect.y,
      width: rect.width,
      height: rect.height,
      top: FAKE_CONTAINER_RECT.y + rect.y,
      left: FAKE_CONTAINER_RECT.x + rect.x,
      right: FAKE_CONTAINER_RECT.x + rect.x + rect.width,
      bottom: FAKE_CONTAINER_RECT.y + rect.y + rect.height,
      toJSON: () => ({}),
    }),
  })
}

export interface FakeGraphicNote {
  sourceNote: Record<string, unknown>
  PositionAndShape: { AbsolutePosition: { x: number; y: number } }
}

/** 播放数据构建用光标替身 + 光标跟随 UI 的调用记录（buildPlaybackData 与光标跟随共用） */
export interface FakeCursor {
  /** reset/next/show/hide 调用序（按序追加） */
  calls: string[]
  reset(): void
  next(): void
  show(): void
  hide(): void
  iterator: {
    readonly EndReached: boolean
    readonly CurrentVoiceEntries: Array<{ IsGrace: boolean; Notes: Array<Record<string, unknown>> }>
    readonly CurrentMeasureIndex: number
    /** 绝对时间戳（fake 音符固定四分，每步推进 0.25）——buildPlaybackData 的 startRv 来源 */
    readonly currentTimeStamp: { RealValue: number }
  }
}

/** 逐步光标替身：每个音符一个 cursor step（单声部）；供 buildPlaybackData 遍历 */
export function createFakeCursor(
  notes: Array<{ source: Record<string, unknown>; measureIndex: number }>,
): FakeCursor {
  const calls: string[] = []
  let index = 0
  return {
    calls,
    reset: () => {
      calls.push('reset')
      index = 0
    },
    next: () => {
      calls.push('next')
      index += 1
    },
    show: () => {
      calls.push('show')
    },
    hide: () => {
      calls.push('hide')
    },
    iterator: {
      get EndReached(): boolean {
        return index >= notes.length
      },
      get CurrentVoiceEntries(): Array<{ IsGrace: boolean; Notes: Array<Record<string, unknown>> }> {
        const note = notes[Math.min(index, notes.length - 1)]
        return note === undefined ? [] : [{ IsGrace: false, Notes: [note.source] }]
      },
      get CurrentMeasureIndex(): number {
        return notes[Math.min(index, notes.length - 1)]?.measureIndex ?? 0
      },
      get currentTimeStamp(): { RealValue: number } {
        return { RealValue: index * 0.25 }
      },
    },
  }
}

export interface FakeOsmdInstance {
  zoom: number
  cursor: FakeCursor
  GraphicSheet: {
    MeasureList: unknown[]
    GetNearestNote: (point: { x: number; y: number }, maxDist: { x: number; y: number }) => unknown
  }
  EngravingRules: Record<string, string>
}

export interface FakeScore {
  osmd: FakeOsmdInstance
  elements: HTMLElement[]
  render: () => void
}

/** 按规格构建图形结构 + DOM 音符头；PAS 坐标 = rect ÷ 10（zoom 1，偏移 0，几何自检必过） */
export function buildFakeScore(spec: FakeScoreSpec, container: HTMLElement): FakeScore {
  container.innerHTML = ''
  const elements: HTMLElement[] = []
  const graphicNotes: FakeGraphicNote[] = []
  const rowIds = new Map<number, Record<string, unknown>>()
  const measureList: unknown[] = []
  const cursorNotes: Array<{ source: Record<string, unknown>; measureIndex: number }> = []

  let pendingTie: TieLike | null = null
  spec.measures.forEach((measureSpec, measureIndex) => {
    let rowKey = rowIds.get(measureSpec.row ?? 0)
    if (rowKey === undefined) {
      rowKey = { row: measureSpec.row ?? 0 }
      rowIds.set(measureSpec.row ?? 0, rowKey)
    }
    const notes = measureSpec.notes.map((noteSpec) => {
      const sourceNote: Record<string, unknown> = {
        IsGraceNote: noteSpec.isGrace === true,
        PrintObject: noteSpec.printObject === false ? false : true,
        // buildPlaybackData 需要的音符面：音高固定 C4、时值四分（spec 未建模音高/时值）
        halfTone: 48,
        Length: { RealValue: 0.25 },
        isRest: () => false,
      }
      if (noteSpec.tie === 'start') {
        pendingTie = { StartNote: sourceNote }
        sourceNote.NoteTie = pendingTie
      } else if (noteSpec.tie === 'continue') {
        sourceNote.NoteTie = pendingTie
      }
      cursorNotes.push({ source: sourceNote, measureIndex })
      const width = noteSpec.width ?? 12
      const height = noteSpec.height ?? 10
      if (noteSpec.printObject !== false) {
        const element = document.createElement('div')
        element.classList.add('vf-notehead')
        stubRect(element, { x: noteSpec.x, y: noteSpec.y, width, height })
        container.appendChild(element)
        elements.push(element)
      }
      const graphicNote: FakeGraphicNote = {
        sourceNote,
        PositionAndShape: { AbsolutePosition: { x: noteSpec.x / 10, y: noteSpec.y / 10 } },
      }
      graphicNotes.push(graphicNote)
      return graphicNote
    })
    measureList.push([
      { ParentStaffLine: rowKey, staffEntries: [{ graphicalVoiceEntries: [{ notes }] }] },
    ])
  })

  const osmd: FakeOsmdInstance = {
    zoom: 1,
    cursor: createFakeCursor(cursorNotes),
    GraphicSheet: {
      MeasureList: measureList,
      // 官方最近邻原语的替身：unit 距离双轴都在 maxDist 内取最近（V-S5 语义）
      GetNearestNote: (point, maxDist) => {
        let best: FakeGraphicNote | null = null
        let bestDist = Number.POSITIVE_INFINITY
        for (const note of graphicNotes) {
          const dx = note.PositionAndShape.AbsolutePosition.x - point.x
          const dy = note.PositionAndShape.AbsolutePosition.y - point.y
          if (Math.abs(dx) > maxDist.x || Math.abs(dy) > maxDist.y) continue
          const dist = dx * dx + dy * dy
          if (dist < bestDist) {
            bestDist = dist
            best = note
          }
        }
        return best
      },
    },
    EngravingRules: {},
  }
  const render = (): void => {
    // 重渲染（缩放/换肤）在替身里是幂等空操作；缓存由组件侧 NoteInteraction 重建
  }
  return { osmd, elements, render }
}

/**
 * OsmdRender 替身：load 按 `FakeOsmdRender.spec` 构建一次并缓存 instance；
 * 测试在渲染前设置 `FakeOsmdRender.spec`。
 */
export class FakeOsmdRender {
  static spec: FakeScoreSpec | null = null
  static last: FakeOsmdRender | null = null

  container: HTMLElement | null = null
  instance: FakeOsmdInstance | null = null
  renderCount = 0
  zoomValue = 1

  constructor(container: HTMLElement) {
    this.container = container
    FakeOsmdRender.last = this
  }

  async load(rawContent: string): Promise<void> {
    if (this.instance === null) {
      const built = buildFakeScore(FakeOsmdRender.spec ?? { measures: [] }, this.container!)
      this.instance = built.osmd
    }
    void rawContent
  }

  get currentZoom(): number {
    return this.zoomValue
  }

  async waitForSvgContent(): Promise<void> {}

  render(): void {
    this.renderCount += 1
  }

  setZoom(zoom: number): void {
    if (zoom === this.zoomValue) return
    this.zoomValue = zoom
    this.render()
  }

  clear(): void {
    this.container?.replaceChildren()
    this.instance = null
  }
}

/** 双行八音符样例（两小节 × 4 音，两行），ScorePage/组件测试共用 */
export const TWO_ROW_SPEC: FakeScoreSpec = {
  measures: [
    {
      row: 0,
      notes: [
        { x: 60, y: 40 },
        { x: 120, y: 40 },
        { x: 180, y: 52 },
        { x: 240, y: 52 },
      ],
    },
    {
      row: 0,
      notes: [
        { x: 300, y: 28 },
        { x: 360, y: 28 },
      ],
    },
    {
      row: 1,
      notes: [
        { x: 60, y: 180 },
        { x: 120, y: 180 },
        { x: 180, y: 192 },
        { x: 240, y: 192 },
      ],
    },
  ],
}

/** 为组件测试预桩 container rect（组件内多处读取） */
export function stubContainerRect(container: HTMLElement): void {
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    ...FAKE_CONTAINER_RECT,
    top: FAKE_CONTAINER_RECT.y,
    left: FAKE_CONTAINER_RECT.x,
    right: FAKE_CONTAINER_RECT.x + FAKE_CONTAINER_RECT.width,
    bottom: FAKE_CONTAINER_RECT.y + FAKE_CONTAINER_RECT.height,
    toJSON: () => ({}),
  } as DOMRect)
}
