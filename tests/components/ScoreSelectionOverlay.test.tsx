import { screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import ScoreSelectionOverlay from '@/components/ScoreSelectionOverlay'
import { enUS } from '@/locales/en-US'
import type { NotePosition } from '@/utils/notation/NoteInteraction'
import { buildRowGeometries } from '@/utils/notation/layout'
import type { ScoreSelection } from '@/utils/notation/selection'
import { renderWithProviders } from '../helpers/ui'

/**
 * previewSelection 优先级契约（docs/selection.md §4.2 v1.6）：拖拽中实时预览
 * 优先于 committed 渲染；null/undefined 回落 committed（未盖到音符时不闪烁清空）。
 */

function makePosition(
  fields: Partial<NotePosition> &
    Pick<NotePosition, 'graphicIndex' | 'noteIndex' | 'rowIndex'>,
): NotePosition {
  return {
    measureIndex: 0,
    x: 0,
    y: 0,
    width: 12,
    height: 10,
    occupiesSlot: true,
    ...fields,
  }
}

/** 两行六音 + 一个装饰音（noteIndex 同下一占位音、不占位） */
const positions: NotePosition[] = [
  makePosition({ graphicIndex: 0, noteIndex: 0, rowIndex: 0, x: 10, y: 100, measureIndex: 0 }),
  makePosition({ graphicIndex: 1, noteIndex: 1, rowIndex: 0, x: 40, y: 100, measureIndex: 0 }),
  makePosition({ graphicIndex: 2, noteIndex: 2, rowIndex: 0, x: 70, y: 104, measureIndex: 1 }),
  // 装饰音：noteIndex = 下一占位音 3（selection.md §2.3），occupiesSlot = false
  makePosition({
    graphicIndex: 3,
    noteIndex: 3,
    rowIndex: 1,
    x: 8,
    y: 196,
    measureIndex: 2,
    occupiesSlot: false,
  }),
  makePosition({ graphicIndex: 4, noteIndex: 3, rowIndex: 1, x: 10, y: 200, measureIndex: 2 }),
  makePosition({ graphicIndex: 5, noteIndex: 4, rowIndex: 1, x: 40, y: 200, measureIndex: 2 }),
  makePosition({ graphicIndex: 6, noteIndex: 5, rowIndex: 1, x: 70, y: 204, measureIndex: 3 }),
]

const rows = buildRowGeometries(positions)

function makeSelection(
  kind: ScoreSelection['kind'],
  startIndex: number,
  endIndex: number,
  startMeasureIndex: number,
  endMeasureIndex: number,
): ScoreSelection {
  return {
    kind,
    startIndex,
    endIndex,
    startMeasureIndex,
    endMeasureIndex,
    startEndpoint: 'slot',
    endEndpoint: 'slot',
  }
}

/** committed 框选 [1..4]（跨两行，measures 1–3） */
const committed = makeSelection('box', 1, 4, 0, 2)
/** 拖拽预览框选 [0..1]（仅第一行，Measure 1） */
const preview = makeSelection('box', 0, 1, 0, 0)

function renderOverlay(props: {
  selection: ScoreSelection | null
  previewSelection?: ScoreSelection | null
  pendingNoteIndex?: number | null
}): void {
  const dragLayerRef = createRef<HTMLDivElement>()
  renderWithProviders(
    <ScoreSelectionOverlay
      positions={positions}
      rows={rows}
      pendingNoteIndex={props.pendingNoteIndex ?? null}
      selection={props.selection}
      previewSelection={props.previewSelection}
      dragLayerRef={dragLayerRef}
    />,
  )
}

describe('ScoreSelectionOverlay previewSelection 优先级（§4.2 v1.6）', () => {
  it('committed selection 渲染行带/音符高亮/pill/边界句柄；装饰音不占位不高亮', () => {
    renderOverlay({ selection: committed })

    const bands = document.querySelectorAll('[data-band]')
    expect(bands).toHaveLength(2)
    expect(bands[0]).toHaveAttribute('data-band', '0')
    expect(bands[1]).toHaveAttribute('data-band', '1')

    // [1..4] 占位音：noteIndex 1,2,3,4（装饰音 occupiesSlot=false 跳过）
    expect(document.querySelectorAll('[data-note-highlight]')).toHaveLength(4)

    expect(
      screen.getByText(`${enUS.selectionBox} · ${enUS.selectionMeasures(1, 3)}`),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-selection-handle="start"]')).not.toBeNull()
    expect(document.querySelector('[data-selection-handle="end"]')).not.toBeNull()
    expect(document.querySelector('[data-drag-layer]')).not.toBeNull()
  })

  it('previewSelection 非空时优先于 committed：行带/高亮/pill 全部按预览区间渲染', () => {
    renderOverlay({ selection: committed, previewSelection: preview })

    // 预览 [0..1] 只在第一行 → 单行带；committed 的第二行带不渲染
    expect(document.querySelectorAll('[data-band]')).toHaveLength(1)
    expect(document.querySelector('[data-band="1"]')).toBeNull()

    expect(document.querySelectorAll('[data-note-highlight]')).toHaveLength(2)
    expect(
      screen.getByText(`${enUS.selectionBox} · ${enUS.selectionMeasures(1, 1)}`),
    ).toBeInTheDocument()
  })

  it('previewSelection 为 null 回落 committed（拖拽矩形下无可选区间时不闪烁清空）', () => {
    renderOverlay({ selection: committed, previewSelection: null })

    expect(document.querySelectorAll('[data-band]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-note-highlight]')).toHaveLength(4)
  })

  it('committed 为 null 且无预览：无任何选择视觉，仅拖拽层常驻', () => {
    renderOverlay({ selection: null })

    expect(document.querySelectorAll('[data-band]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-note-highlight]')).toHaveLength(0)
    expect(document.querySelector('[data-selection-handle="start"]')).toBeNull()
    expect(screen.queryByText(new RegExp(enUS.selectionBox))).not.toBeInTheDocument()
    expect(document.querySelector('[data-drag-layer]')).not.toBeNull()
  })

  it('pending 起点弱高亮独立于选择区间（双击乐句第一击的起点标记）', () => {
    renderOverlay({ selection: null, pendingNoteIndex: 4 })

    expect(document.querySelectorAll('[data-pending]')).toHaveLength(1)
    // pending 不产生行带/音符高亮（只是起点标记，§5）
    expect(document.querySelectorAll('[data-band]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-note-highlight]')).toHaveLength(0)
  })
})
