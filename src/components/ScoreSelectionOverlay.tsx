import { useMemo, type RefObject } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { NotePosition } from '../utils/notation/NoteInteraction'
import { computeRowHighlights, type RowGeometry } from '../utils/notation/layout'
import type { ScoreSelection } from '../utils/notation/selection'
import { useI18n } from '../locales/useI18n'

/**
 * 统一选择覆盖层栈（docs/selection.md §5，决策 S7）：容器内绝对定位 HTML 层承载全部
 * 选择视觉——pending 起点弱高亮、committed 行带与音符高亮、START/END 旗标与括号、
 * 标签 pill、（框选）边界句柄与拖拽实时矩形。除边界句柄外 pointer-events: none；
 * 坐标全部读渲染后 rect 缓存（零 DOM 读取），任何选择变化不触发 OSMD 重渲染。
 * 拖拽高频更新由 OsmdNotation 经 dragLayerRef 直写 style，不进 React state（§4.2）。
 */
const styles = stylex.create({
  root: {
    position: 'absolute',
    inset: 0,
    overflow: 'visible',
    zIndex: 8,
    pointerEvents: 'none',
  },
  band: {
    position: 'absolute',
    borderRadius: '8px',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 7%, transparent)',
  },
  note: {
    position: 'absolute',
    borderRadius: '3px',
    backgroundColor: 'var(--color-verm-soft)',
  },
  bracket: {
    position: 'absolute',
    height: '8px',
    borderWidth: '2.4px',
    borderStyle: 'solid',
    borderBottomWidth: 0,
    borderColor: 'var(--color-verm)',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
  },
  flagBar: {
    position: 'absolute',
    width: '3.5px',
    borderRadius: '1.5px',
    backgroundColor: 'var(--color-verm)',
  },
  flagArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderTop: '5px solid transparent',
    borderBottom: '5px solid transparent',
  },
  arrowStart: {
    borderLeft: '8px solid var(--color-verm)',
  },
  arrowEnd: {
    borderRight: '8px solid var(--color-verm)',
  },
  pill: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    borderRadius: 9999,
    paddingInline: '12px',
    paddingBlock: '3px',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: '12px',
    whiteSpace: 'nowrap',
    color: 'var(--color-paper)',
    backgroundColor: 'var(--color-verm)',
  },
  pending: {
    position: 'absolute',
    borderRadius: '3px',
    backgroundColor: 'color-mix(in srgb, var(--color-ink) 8%, transparent)',
  },
  dragLayer: {
    position: 'absolute',
    display: 'none',
    borderRadius: '2px',
    backgroundColor: 'color-mix(in srgb, var(--color-ink) 8%, transparent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--color-ink) 35%, transparent)',
  },
  handle: {
    position: 'absolute',
    width: '13px',
    transform: 'translateX(-50%)',
    cursor: 'ew-resize',
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    height: '26px',
    width: '4px',
    borderRadius: '2px',
    backgroundColor: 'var(--color-verm)',
    boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-paper) 80%, transparent)',
  },
})

interface ScoreSelectionOverlayProps {
  positions: readonly NotePosition[]
  rows: readonly RowGeometry[]
  /** pending 起点音符（弱高亮），无则 null */
  pendingNoteIndex: number | null
  selection: ScoreSelection | null
  /** 拖拽实时矩形层（pointermove 期间由容器直写 style；句柄按下由容器 closest 路由） */
  dragLayerRef: RefObject<HTMLDivElement | null>
}

export default function ScoreSelectionOverlay({
  positions,
  rows,
  pendingNoteIndex,
  selection,
  dragLayerRef,
}: ScoreSelectionOverlayProps) {
  const { t } = useI18n()

  const highlights = useMemo(
    () => (selection === null ? [] : computeRowHighlights(selection, positions, rows)),
    [selection, positions, rows],
  )

  const selectedNotes = useMemo(() => {
    if (selection === null) return []
    return positions.filter(
      (p) => p.occupiesSlot && p.noteIndex >= selection.startIndex && p.noteIndex <= selection.endIndex,
    )
  }, [selection, positions])

  const pendingNote = useMemo(() => {
    if (pendingNoteIndex === null) return null
    return positions.find((p) => p.occupiesSlot && p.noteIndex === pendingNoteIndex) ?? null
  }, [pendingNoteIndex, positions])

  const firstRow = highlights[0]
  const lastRow = highlights[highlights.length - 1]

  const measuresText =
    selection !== null
      ? t.selectionMeasures(selection.startMeasureIndex + 1, selection.endMeasureIndex + 1)
      : ''
  const pillText =
    selection === null
      ? ''
      : selection.kind === 'box'
        ? `${t.selectionBox} · ${measuresText}`
        : `${t.selectionPhrase} · ${measuresText}`

  return (
    <div {...stylex.props(styles.root)} aria-hidden="true">
      {highlights.map((rect) => (
        <div
          key={`band-${rect.rowIndex}`}
          {...stylex.props(styles.band)}
          style={{ left: rect.x1, top: rect.y, width: rect.x2 - rect.x1, height: rect.height }}
        />
      ))}
      {selectedNotes.map((note) => (
        <div
          key={`note-${note.graphicIndex}`}
          {...stylex.props(styles.note)}
          style={{ left: note.x - 1, top: note.y - 1, width: note.width + 2, height: note.height + 2 }}
        />
      ))}
      {highlights.map((rect) => (
        <div
          key={`bracket-${rect.rowIndex}`}
          {...stylex.props(styles.bracket)}
          style={{ left: rect.x1, top: rect.y - 12, width: rect.x2 - rect.x1 }}
        />
      ))}
      {firstRow !== undefined && (
        <>
          <div
            {...stylex.props(styles.flagBar)}
            style={{ left: firstRow.x1 - 6, top: firstRow.y, height: firstRow.height }}
          />
          <div
            {...stylex.props(styles.flagArrow, styles.arrowStart)}
            style={{ left: firstRow.x1 + 3, top: firstRow.y + firstRow.height / 2 - 5 }}
          />
        </>
      )}
      {lastRow !== undefined && (
        <>
          <div
            {...stylex.props(styles.flagBar)}
            style={{ left: lastRow.x2 + 2.5, top: lastRow.y, height: lastRow.height }}
          />
          <div
            {...stylex.props(styles.flagArrow, styles.arrowEnd)}
            style={{ left: lastRow.x2 - 11.5, top: lastRow.y + lastRow.height / 2 - 5 }}
          />
        </>
      )}
      {selection !== null && firstRow !== undefined && (
        <div
          {...stylex.props(styles.pill)}
          style={{
            left: (firstRow.x1 + firstRow.x2) / 2,
            top: Math.max(0, firstRow.y - 34),
          }}
        >
          {pillText}
        </div>
      )}
      {pendingNote !== null && (
        <div
          {...stylex.props(styles.pending)}
          style={{
            left: pendingNote.x - 2,
            top: pendingNote.y - 2,
            width: pendingNote.width + 4,
            height: pendingNote.height + 4,
          }}
        />
      )}
      {selection?.kind === 'box' && firstRow !== undefined && lastRow !== undefined && (
        <>
          <div
            {...stylex.props(styles.handle)}
            data-selection-handle="start"
            style={{ left: firstRow.x1, top: firstRow.y, height: firstRow.height }}
          >
            <div {...stylex.props(styles.handleBar)} />
          </div>
          <div
            {...stylex.props(styles.handle)}
            data-selection-handle="end"
            style={{ left: lastRow.x2, top: lastRow.y, height: lastRow.height }}
          >
            <div {...stylex.props(styles.handleBar)} />
          </div>
        </>
      )}
      <div ref={dragLayerRef} data-drag-layer="" {...stylex.props(styles.dragLayer)} />
    </div>
  )
}
