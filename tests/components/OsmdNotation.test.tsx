import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactElement } from 'react'

import OsmdNotation from '@/components/OsmdNotation'
import type { PlaybackEngine, PlaybackIterationEvent, PlaybackState } from '@/audio/PlaybackEngine'
import type { PlaybackEntry } from '@/types/playback'
import { enUS } from '@/locales/en-US'
import type { ScoreSelection, SelectionSummary } from '@/utils/notation/selection'
import { renderWithProviders } from '../helpers/ui'
import {
  FAKE_CONTAINER_RECT,
  FakeOsmdRender,
  TWO_ROW_SPEC,
  specClientCoords,
  stubElementFromPointBySpec,
  type FakeScoreSpec,
} from '../helpers/osmdFake'

vi.mock('@/utils/notation/OsmdRender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/notation/OsmdRender')>()
  const { FakeOsmdRender } = await import('../helpers/osmdFake')
  return { ...actual, OsmdRender: FakeOsmdRender }
})

type SelectionCall = [ScoreSelection | null, SelectionSummary | null]

/**
 * 与 ScorePage 同构的有状态包装：把 onSelectionChange 回灌到 selection prop
 * （覆盖层/句柄依赖受控 selection 渲染），同时把每次调用记录进 mock。
 */
function setupHarness(
  onSelectionChange: (selection: ScoreSelection | null, summary: SelectionSummary | null) => void,
  onSelectionInvalid: () => void,
  initial: { selection?: ScoreSelection | null; clearPendingSignal?: number } = {},
) {
  function Harness(): ReactElement {
    const [selection, setSelection] = useState<ScoreSelection | null>(initial.selection ?? null)
    const handleChange = (next: ScoreSelection | null, summary: SelectionSummary | null): void => {
      setSelection(next)
      onSelectionChange(next, summary)
    }
    return (
      <OsmdNotation
        rawContent="<fake-score/>"
        selection={selection}
        onSelectionChange={handleChange}
        onSelectionInvalid={onSelectionInvalid}
        clearPendingSignal={initial.clearPendingSignal ?? 0}
      />
    )
  }
  return renderWithProviders(<Harness />)
}

function setup(spec: FakeScoreSpec = TWO_ROW_SPEC) {
  FakeOsmdRender.spec = spec
  const onSelectionChange = vi.fn<(selection: ScoreSelection | null, summary: SelectionSummary | null) => void>()
  const onSelectionInvalid = vi.fn()
  const utils = setupHarness(onSelectionChange, onSelectionInvalid)
  return { onSelectionChange, onSelectionInvalid, ...utils }
}

function SignalHarness({
  onSelectionChange,
  signal,
}: {
  onSelectionChange: (selection: ScoreSelection | null, summary: SelectionSummary | null) => void
  signal: number
}): ReactElement {
  const [selection, setSelection] = useState<ScoreSelection | null>(null)
  const handleChange = (next: ScoreSelection | null, summary: SelectionSummary | null): void => {
    setSelection(next)
    onSelectionChange(next, summary)
  }
  return (
    <OsmdNotation
      rawContent="<fake-score/>"
      selection={selection}
      onSelectionChange={handleChange}
      onSelectionInvalid={vi.fn()}
      clearPendingSignal={signal}
    />
  )
}

function lastCall(calls: readonly SelectionCall[]): SelectionCall {
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1]!
}

async function waitForGeometry(): Promise<HTMLElement[]> {
  const stage = await waitFor(() => {
    const element = document.querySelector('[data-osmd-stage]')
    expect(element).not.toBeNull()
    return element as HTMLElement
  })
  await waitFor(() => {
    // 几何就绪后覆盖层挂载（dragLayer 存在）
    expect(stage.querySelector('[data-drag-layer]')).not.toBeNull()
  })
  return Array.from(stage.querySelectorAll('.vf-notehead')) as HTMLElement[]
}

const client = (local: number, offset: number): number => local + offset

function pointerDown(target: Element, x: number, y: number, extra: Record<string, unknown> = {}): void {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: client(x, FAKE_CONTAINER_RECT.x),
    clientY: client(y, FAKE_CONTAINER_RECT.y),
    ...extra,
  })
}

function pointerMove(target: Element, x: number, y: number, extra: Record<string, unknown> = {}): void {
  fireEvent.pointerMove(target, {
    pointerId: 1,
    clientX: client(x, FAKE_CONTAINER_RECT.x),
    clientY: client(y, FAKE_CONTAINER_RECT.y),
    ...extra,
  })
}

function pointerUp(target: Element, x: number, y: number): void {
  fireEvent.pointerUp(target, {
    pointerId: 1,
    clientX: client(x, FAKE_CONTAINER_RECT.x),
    clientY: client(y, FAKE_CONTAINER_RECT.y),
  })
}

describe('OsmdNotation', () => {
  afterEach(() => {
    FakeOsmdRender.spec = null
    FakeOsmdRender.last = null
  })

  it('未加载乐谱时渲染占位文案与页脚', () => {
    renderWithProviders(
      <OsmdNotation selection={null} onSelectionChange={vi.fn()} onSelectionInvalid={vi.fn()} />,
    )

    expect(screen.getByText(enUS.notationPlaceholder)).toBeInTheDocument()
    expect(screen.getByText(enUS.notationFootInfo)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(FakeOsmdRender.last).toBeNull()
  })

  it('有 rawContent 时以原文加载、注入音符 DOM；缩放按钮步进并重渲染', async () => {
    setup()
    await waitForGeometry()

    expect(FakeOsmdRender.last).not.toBeNull()
    expect(FakeOsmdRender.last!.instance).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: enUS.notationZoomIn }))
    await waitFor(() => expect(screen.getByText('110%')).toBeInTheDocument())
    expect(FakeOsmdRender.last!.renderCount).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: enUS.notationZoomOut }))
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument())
  })

  it('单击音符 = 即时选其所在小节（零延迟）', async () => {
    const { onSelectionChange } = setup()
    const notes = await waitForGeometry()

    pointerDown(notes[0]!, 60, 40)
    pointerUp(notes[0]!, 60, 40)

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled())
    const [selection, summary] = lastCall(onSelectionChange.mock.calls)
    expect(selection).toMatchObject({ kind: 'measure', startIndex: 0, endIndex: 3 })
    expect(summary).toMatchObject({ kind: 'measure', noteCount: 4 })
  })

  it('双击两点设乐句（原生 dblclick，capture 重定向后按坐标命中）；重复信号幂等', async () => {
    const { onSelectionChange } = setup()
    const notes = await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement

    // 真浏览器：pointer capture 把 dblclick 重定向到 stage（target=stage），组件用
    // elementFromPoint 坐标命中——jsdom 无布局，桩按 osmdFake 坐标约定复刻该链路
    const restore = stubElementFromPointBySpec(TWO_ROW_SPEC, notes)
    const coords = specClientCoords(TWO_ROW_SPEC)
    const at = (index: number): { clientX: number; clientY: number } => ({
      clientX: coords[index]!.x,
      clientY: coords[index]!.y,
    })

    fireEvent.doubleClick(stage, at(1))
    // pending 阶段：不提交
    expect(onSelectionChange).not.toHaveBeenCalled()

    fireEvent.doubleClick(stage, at(4))
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled())
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'phrase',
      startIndex: 1,
      endIndex: 4,
    })

    // 终点音符在窗口内的重复双击信号（触控双路径）不产生新 pending/提交
    const callsBefore = onSelectionChange.mock.calls.length
    fireEvent.doubleClick(stage, at(4))
    expect(onSelectionChange.mock.calls.length).toBe(callsBefore)

    restore()
  })

  it('空白拖拽 = 框选，抬手提交跨行区间；音符上拖拽不产生任何选择', async () => {
    const { onSelectionChange } = setup()
    const notes = await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement

    // 空白起板 → 拖拽跨越两行 → 提交
    pointerDown(stage, 90, 30)
    pointerMove(stage, 130, 30)
    pointerMove(stage, 130, 190)
    pointerUp(stage, 130, 190)
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled())
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'box',
      startIndex: 1,
      endIndex: 7,
    })

    // 音符上起板拖拽 = 取消，不进入框选
    const callsBefore = onSelectionChange.mock.calls.length
    pointerDown(notes[0]!, 60, 40)
    pointerMove(notes[0]!, 200, 60)
    pointerUp(notes[0]!, 200, 60)
    expect(onSelectionChange.mock.calls.length).toBe(callsBefore)
  })

  it('框选拖拽期间选中区域实时预览（不提交），抬手才 commit', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    pointerDown(stage, 90, 30)
    pointerMove(stage, 130, 30)
    // 起板即预览：第一行盖到音符 1，行带 + 音符高亮在拖拽中就出现
    await waitFor(() => expect(stage.querySelectorAll('[data-band]')).toHaveLength(1))
    expect(stage.querySelectorAll('[data-note-highlight]')).toHaveLength(1)
    expect(onSelectionChange).not.toHaveBeenCalled()

    // 拖到第二行：行带与音符高亮随拖动实时扩展
    pointerMove(stage, 130, 190)
    await waitFor(() => expect(stage.querySelectorAll('[data-band]')).toHaveLength(2))
    expect(stage.querySelectorAll('[data-note-highlight]')).toHaveLength(7)
    expect(onSelectionChange).not.toHaveBeenCalled()

    // 抬手提交，预览移交 committed（同一批次，视觉无空档）
    pointerUp(stage, 130, 190)
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledTimes(1))
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'box',
      startIndex: 1,
      endIndex: 7,
    })
  })

  it('拖拽中按下 Shift 即时并入预览与提交（修饰键取最新事件状态，§4.2 v1.6）', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    // 先框选提交 [1..1]（同款坐标：第一行盖到音符 1）
    pointerDown(stage, 90, 30)
    pointerMove(stage, 130, 30)
    pointerUp(stage, 130, 30)
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledTimes(1))
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'box',
      startIndex: 1,
      endIndex: 1,
    })

    // 第二次框选音符 4、5：先无 Shift（独立区间 ≠ 已提交的 1 个高亮，等待非空），
    // 中途按下 Shift → 预览即时并成 [1..5]（applyBoxModifiers 并集）
    pointerDown(stage, 290, 40) // 音符 3/4 之间的空白起板
    pointerMove(stage, 370, 40) // 盖到音符 4、5（中心 306/366），未按 Shift
    await waitFor(() => expect(stage.querySelectorAll('[data-note-highlight]')).toHaveLength(2))

    pointerMove(stage, 370, 40, { shiftKey: true }) // 同位置按下 Shift 并入既有 [1..1]
    await waitFor(() => expect(stage.querySelectorAll('[data-note-highlight]')).toHaveLength(5))
    expect(onSelectionChange).toHaveBeenCalledTimes(1) // 仍是预览，未提交

    pointerUp(stage, 370, 40)
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledTimes(2))
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'box',
      startIndex: 1,
      endIndex: 5,
    })
  })

  it('拖拽中 pointercancel 中止，不产生选择', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    pointerDown(stage, 90, 30)
    pointerMove(stage, 150, 60)
    fireEvent.pointerCancel(stage, { pointerId: 1 })
    pointerUp(stage, 200, 100)

    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('pointercancel 清除拖拽实时预览，不留选中视觉', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    pointerDown(stage, 90, 30)
    pointerMove(stage, 130, 30)
    await waitFor(() => expect(stage.querySelectorAll('[data-band]')).toHaveLength(1))

    fireEvent.pointerCancel(stage, { pointerId: 1 })
    await waitFor(() => expect(stage.querySelectorAll('[data-band]')).toHaveLength(0))
    expect(stage.querySelectorAll('[data-note-highlight]')).toHaveLength(0)
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('单击未拖过阈值的空白不产生选择', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    pointerDown(stage, 500, 300)
    pointerUp(stage, 500, 300)

    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('框选边界句柄：拖拽微调吸附到最近音符', async () => {
    const { onSelectionChange } = setup()
    const stage = (await waitForGeometry()) && (document.querySelector('[data-osmd-stage]') as HTMLElement)

    // 先框选出一个区间
    pointerDown(stage, 90, 30)
    pointerMove(stage, 190, 60)
    pointerUp(stage, 190, 60)
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled())
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({ kind: 'box' })

    // selection prop 回灌后句柄出现；拖 start 句柄到音符 2 位置（吸附）
    const handle = await waitFor(() => {
      const element = stage.querySelector('[data-selection-handle="start"]')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })
    pointerDown(handle, 80, 40)
    pointerMove(handle, 180, 45)
    pointerUp(handle, 180, 45)

    await waitFor(() => expect(onSelectionChange.mock.calls.length).toBeGreaterThan(1))
    expect(lastCall(onSelectionChange.mock.calls)[0]).toMatchObject({
      kind: 'box',
      startIndex: 2,
    })
  })

  it('外部清零信号销毁 pending：双击第一击后清零，再双击按新乐句起点处理（不提交）', async () => {
    const onSelectionChange = vi.fn<(selection: ScoreSelection | null, summary: SelectionSummary | null) => void>()
    FakeOsmdRender.spec = TWO_ROW_SPEC
    const { rerender } = renderWithProviders(
      <SignalHarness onSelectionChange={onSelectionChange} signal={0} />,
    )
    const notes = await waitForGeometry()

    fireEvent.doubleClick(notes[0]!)
    rerender(<SignalHarness onSelectionChange={onSelectionChange} signal={1} />)
    fireEvent.doubleClick(notes[3]!)

    expect(onSelectionChange).not.toHaveBeenCalled()
  })
})

// ── 双指视口手势（PRD G12 触控专项）：捏合缩放 + 双指平移，不产生选择 ──

describe('OsmdNotation 双指视口手势', () => {
  afterEach(() => {
    FakeOsmdRender.spec = null
    FakeOsmdRender.last = null
  })

  /** 双指事件助手：pointerId 1 = 主指，2 = 非主指（第二触点），坐标走 FAKE_CONTAINER_RECT 换算 */
  function makePinch(stage: HTMLElement) {
    const at = (x: number, y: number): Record<string, unknown> => ({
      clientX: client(x, FAKE_CONTAINER_RECT.x),
      clientY: client(y, FAKE_CONTAINER_RECT.y),
    })
    return {
      down(pointerId: number, x: number, y: number, isPrimary: boolean): void {
        fireEvent.pointerDown(stage, { pointerId, isPrimary, button: 0, pointerType: 'touch', ...at(x, y) })
      },
      move(pointerId: number, x: number, y: number): void {
        fireEvent.pointerMove(stage, { pointerId, ...at(x, y) })
      },
      up(pointerId: number, x: number, y: number): void {
        fireEvent.pointerUp(stage, { pointerId, ...at(x, y) })
      },
      cancel(pointerId: number): void {
        fireEvent.pointerCancel(stage, { pointerId })
      },
    }
  }

  it('双指捏合放大：抬手提交缩放重排、页脚倍率更新，不产生选择', async () => {
    const { onSelectionChange } = setup()
    await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    const p = makePinch(stage)
    const rendersBefore = FakeOsmdRender.last!.renderCount

    p.down(1, 200, 100, true)
    p.down(2, 300, 110, false) // span ≈100 → 捏合建立
    p.move(1, 100, 100)
    p.move(2, 400, 110) // span ≈300 → target = 3 → 钳到 ZOOM_MAX 2
    await waitFor(() => expect(screen.getByText('200%')).toBeInTheDocument())
    // CSS transform 预览在拖拽中存在（OSMD 真重排等抬手）
    expect(document.querySelector('[style*="scale("]')).not.toBeNull()

    p.up(1, 100, 100)
    await waitFor(() => expect(FakeOsmdRender.last!.renderCount).toBeGreaterThan(rendersBefore))
    await waitFor(() => expect(screen.getByText('200%')).toBeInTheDocument())
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('双指并拢落下再展开：move 中补建捏合并提交', async () => {
    setup()
    await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    const p = makePinch(stage)
    const rendersBefore = FakeOsmdRender.last!.renderCount

    p.down(1, 200, 100, true)
    p.down(2, 210, 100, false) // span 10 < 24 → 起板不建立
    p.move(1, 100, 100) // 坐标跟进后 span 110 → 补建捏合
    p.move(2, 410, 100) // span 310 → target 钳到 2
    p.up(2, 410, 100)

    await waitFor(() => expect(FakeOsmdRender.last!.renderCount).toBeGreaterThan(rendersBefore))
    await waitFor(() => expect(screen.getByText('200%')).toBeInTheDocument())
  })

  it('第二指落下作废第一指的候选 tap：双指手势不产生任何选择', async () => {
    const { onSelectionChange } = setup()
    const notes = await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    const p = makePinch(stage)

    pointerDown(notes[0]!, 60, 40) // 主指按在音符上 = 候选 tap
    p.down(2, 300, 200, false) // 第二指落下 → 捏合接管，候选作废
    p.up(1, 60, 40)
    p.up(2, 320, 220)

    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('pointercancel 中断捏合：缩放显示回退、transform 清除、不重排', async () => {
    const { onSelectionChange } = setup()
    await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    const p = makePinch(stage)
    const rendersBefore = FakeOsmdRender.last!.renderCount

    p.down(1, 200, 100, true)
    p.down(2, 300, 100, false)
    p.move(1, 100, 100)
    p.move(2, 400, 100)
    await waitFor(() => expect(screen.getByText('200%')).toBeInTheDocument())

    p.cancel(1)
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument())
    expect(document.querySelector('[style*="scale("]')).toBeNull()
    p.up(2, 400, 100)
    expect(FakeOsmdRender.last!.renderCount).toBe(rendersBefore)
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('双指平移：中点位移写 stage 滚动，纯平移不触发重排', async () => {
    setup()
    await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    Object.defineProperty(stage, 'scrollWidth', { configurable: true, value: 2000 })
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 800 })
    const p = makePinch(stage)
    const rendersBefore = FakeOsmdRender.last!.renderCount

    p.down(1, 400, 100, true)
    p.down(2, 500, 100, false) // mid = 450
    p.move(1, 340, 100)
    p.move(2, 440, 100) // mid = 390 → scrollLeft = 0 - (390-450) = 60
    expect(stage.scrollLeft).toBe(60)
    expect(screen.getByText('100%')).toBeInTheDocument() // 跨度不变：纯平移

    p.up(1, 340, 100)
    p.up(2, 440, 100)
    expect(FakeOsmdRender.last!.renderCount).toBe(rendersBefore)
    expect(stage.scrollLeft).toBe(60)
  })

  it('捏合缩小到下限：提交 50% 并重排', async () => {
    setup()
    await waitForGeometry()
    const stage = document.querySelector('[data-osmd-stage]') as HTMLElement
    const p = makePinch(stage)
    const rendersBefore = FakeOsmdRender.last!.renderCount

    p.down(1, 300, 100, true)
    p.down(2, 100, 100, false) // span 200
    p.move(1, 350, 100)
    p.move(2, 250, 100) // span 100 → target 0.5
    p.up(1, 350, 100)

    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
    await waitFor(() => expect(FakeOsmdRender.last!.renderCount).toBeGreaterThan(rendersBefore))
  })
})

// ── 光标跟随与播放数据（docs/audio.md §3.8，P3 接入）────────────────────

/** 引擎替身：只暴露 OsmdNotation 订阅的面（onIteration/onStateChange/指针直读） */
class FakePlaybackEngine {
  state: PlaybackState = 'STOPPED'
  entryIndex = -1
  private readonly iterationHandlers = new Set<(event: PlaybackIterationEvent) => void>()
  private readonly stateHandlers = new Set<(state: PlaybackState) => void>()

  onIteration(handler: (event: PlaybackIterationEvent) => void): () => void {
    this.iterationHandlers.add(handler)
    return () => this.iterationHandlers.delete(handler)
  }

  onStateChange(handler: (state: PlaybackState) => void): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  getState(): PlaybackState {
    return this.state
  }

  getCurrentEntryIndex(): number {
    return this.entryIndex
  }

  emitState(state: PlaybackState): void {
    this.state = state
    for (const handler of this.stateHandlers) handler(state)
  }

  emitIteration(resetOccurred = false): void {
    // 载荷契约与真实引擎同构：entry = 刚发声条目（索引由测试显式设 entryIndex）
    const index = this.entryIndex
    const entry =
      index < 0
        ? null
        : { startRv: 0, durationRv: 0.25, measureIndex: 0, noteIndex: index, noteName: 'C4' }
    for (const handler of this.iterationHandlers) {
      handler({ entry, resetOccurred })
    }
  }
}

function engineHarness(engine: FakePlaybackEngine): {
  onPlaybackDataReady: ReturnType<typeof vi.fn>
} {
  const onPlaybackDataReady = vi.fn<(entries: PlaybackEntry[], scoreKey: string) => void>()
  FakeOsmdRender.spec = TWO_ROW_SPEC
  renderWithProviders(
    <OsmdNotation
      rawContent="<fake-score/>"
      selection={null}
      onSelectionChange={vi.fn()}
      onSelectionInvalid={vi.fn()}
      engine={engine as unknown as PlaybackEngine}
      onPlaybackDataReady={onPlaybackDataReady}
    />,
  )
  return { onPlaybackDataReady }
}

function cursorCalls(): string[] {
  const last = FakeOsmdRender.last
  expect(last).not.toBeNull()
  return last!.instance!.cursor.calls
}

function playheadElement(): HTMLElement | null {
  return document.querySelector('[data-playhead]')
}

describe('OsmdNotation 播放光标带与播放数据（docs/audio.md §3.8）', () => {
  afterEach(() => {
    FakeOsmdRender.spec = null
    FakeOsmdRender.last = null
  })

  it('装载后上报播放数据（乐谱时域条目 + 谱键），光标遍历后复位', async () => {
    const engine = new FakePlaybackEngine()
    const { onPlaybackDataReady } = engineHarness(engine)
    await waitForGeometry()
    await waitFor(() => expect(onPlaybackDataReady).toHaveBeenCalled())
    const [entries, scoreKey] = onPlaybackDataReady.mock.calls[0]!
    expect(scoreKey).toBe('<fake-score/>')
    // TWO_ROW_SPEC：3 小节 10 音，全四分符，halfTone 48（OSMD 记法 C4）
    expect(entries).toHaveLength(10)
    expect(entries[0]).toEqual({
      startRv: 0,
      durationRv: 0.25,
      measureIndex: 0,
      noteIndex: 0,
      noteName: 'C4',
    })
    expect(entries[9]).toMatchObject({ startRv: 2.25, noteIndex: 9 })
    expect(cursorCalls()).toContain('reset') // 构建后复位（数据只读）
  })

  it('未播放无光标带；PLAYING + 首 iteration 起显示，位置跟随引擎指针', async () => {
    const engine = new FakePlaybackEngine()
    engineHarness(engine)
    await waitForGeometry()
    expect(playheadElement()).toBeNull()

    engine.emitState('PLAYING')
    engine.entryIndex = 0
    engine.emitIteration()
    const band = await waitFor(() => {
      const element = playheadElement()
      expect(element).not.toBeNull()
      return element as HTMLElement
    })
    expect(band.style.left).toBe('77px') // 音符 0 @ spec x 60 + 容器偏移 20，带左缘外扩 3px
    expect(band.style.top).toBe('22px') // 行带 y 38（音符包络 + 偏移 − 12px 外扩）再外扩 4px，盖过五线谱
  })

  it('同帧多次 iteration 合并，位置取最新指针；回跳（resetOccurred）自动跟随', async () => {
    const engine = new FakePlaybackEngine()
    engineHarness(engine)
    await waitForGeometry()

    engine.emitState('PLAYING')
    engine.entryIndex = 2
    engine.emitIteration()
    engine.emitIteration() // 同帧第二击
    await waitFor(() => expect(playheadElement()?.style.left).toBe('197px')) // 音符 2 @ spec x 180 + 偏移
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(1)

    engine.entryIndex = 0 // 循环回跳后指针回起点：索引直读，无需显式复位
    engine.emitIteration(true)
    await waitFor(() => expect(playheadElement()?.style.left).toBe('77px'))
  })

  it('播放中缩放重渲染：光标带不丢不跳（视觉活在覆盖层，无需 OSMD 光标重同步）', async () => {
    const engine = new FakePlaybackEngine()
    engineHarness(engine)
    await waitForGeometry()

    engine.emitState('PLAYING')
    engine.entryIndex = 6 // 第二行首音 @ spec x 60, y 180（+ 容器偏移）
    engine.emitIteration()
    await waitFor(() => expect(playheadElement()?.style.top).toBe('174px'))

    fireEvent.click(screen.getByRole('button', { name: enUS.notationZoomIn }))
    await waitFor(() => expect(screen.getByText('110%')).toBeInTheDocument())
    expect(playheadElement()?.style.top).toBe('174px')
    expect(playheadElement()?.style.left).toBe('77px')
  })

  it('STOPPED：光标带立即移除', async () => {
    const engine = new FakePlaybackEngine()
    engineHarness(engine)
    await waitForGeometry()

    engine.emitState('PLAYING')
    engine.entryIndex = 1
    engine.emitIteration()
    await waitFor(() => expect(playheadElement()).not.toBeNull())

    engine.emitState('STOPPED')
    await waitFor(() => expect(playheadElement()).toBeNull())
  })
})
