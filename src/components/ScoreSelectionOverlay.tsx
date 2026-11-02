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
 * 拖拽高频更新由 OsmdNotation 经 dragLayerRef 直写 style，不进 React state（§4.2）；
 * 拖拽中的选中区域实时预览（previewSelection，区间变化门控）优先于 committed 渲染。
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
  // 播放光标带（ui-design.html v3：金铜仅表示播放中）：行带再外扩一档盖过五线谱，
  // 左缘金铜竖线读作光标本体；仅水平位移过渡（跨行瞬移，不纵向滑动）
  playhead: {
    position: 'absolute',
    borderRadius: '6px',
    backgroundColor: 'color-mix(in srgb, var(--color-gold-bright) 15%, transparent)',
    boxShadow: 'inset 2.5px 0 0 var(--color-gold-bright)',
    transitionProperty: 'left',
    transitionDuration: '80ms',
    transitionTimingFunction: 'linear',
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
  /** 框选拖拽实时预览（§4.2 v1.6）；null/undefined = 未拖拽或矩形下无可选区间，回落 selection */
  previewSelection?: ScoreSelection | null
  /** 播放中音符（金铜光标带，audio.md §3.8 引擎指针直读）；null = 未播放 */
  playingNoteIndex?: number | null
  /** 拖拽实时矩形层（pointermove 期间由容器直写 style；句柄按下由容器 closest 路由） */
  dragLayerRef: RefObject<HTMLDivElement | null>
}

export default function ScoreSelectionOverlay({
  positions,
  rows,
  pendingNoteIndex,
  selection,
  previewSelection,
  playingNoteIndex = null,
  dragLayerRef,
}: ScoreSelectionOverlayProps) {
  const { t } = useI18n()

  // 拖拽中预览优先（实时选中框跟随拖动）；null 回落 committed，避免未盖到音符时闪烁清空
  const active = previewSelection ?? selection

  const highlights = useMemo(
    () => (active === null ? [] : computeRowHighlights(active, positions, rows)),
    [active, positions, rows],
  )

  const selectedNotes = useMemo(() => {
    if (active === null) return []
    return positions.filter(
      (p) => p.occupiesSlot && p.noteIndex >= active.startIndex && p.noteIndex <= active.endIndex,
    )
  }, [active, positions])

  const pendingNote = useMemo(() => {
    if (pendingNoteIndex === null) return null
    return positions.find((p) => p.occupiesSlot && p.noteIndex === pendingNoteIndex) ?? null
  }, [pendingNoteIndex, positions])

  const playingNote = useMemo(() => {
    if (playingNoteIndex === null) return null
    return positions.find((p) => p.occupiesSlot && p.noteIndex === playingNoteIndex) ?? null
  }, [playingNoteIndex, positions])

  const playingRow = useMemo(
    () =>
      playingNote === null ? undefined : rows.find((row) => row.rowIndex === playingNote.rowIndex),
    [playingNote, rows],
  )

  const firstRow = highlights[0]
  const lastRow = highlights[highlights.length - 1]

  const measuresText =
    active !== null
      ? t.selectionMeasures(active.startMeasureIndex + 1, active.endMeasureIndex + 1)
      : ''
  const pillText =
    active === null
      ? ''
      : active.kind === 'box'
        ? `${t.selectionBox} · ${measuresText}`
        : `${t.selectionPhrase} · ${measuresText}`

  return (
    <div {...stylex.props(styles.root)} aria-hidden="true">
      {playingNote !== null && playingRow !== undefined && (
        <div
          data-playhead=""
          {...stylex.props(styles.playhead)}
          style={{
            left: playingNote.x - 3,
            top: playingRow.y - 4,
            width: playingNote.width + 6,
            height: playingRow.height + 8,
          }}
        />
      )}
      {highlights.map((rect) => (
        <div
          key={`band-${rect.rowIndex}`}
          data-band={rect.rowIndex}
          {...stylex.props(styles.band)}
          style={{ left: rect.x1, top: rect.y, width: rect.x2 - rect.x1, height: rect.height }}
        />
      ))}
      {selectedNotes.map((note) => (
        <div
          key={`note-${note.graphicIndex}`}
          data-note-highlight=""
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
      {active !== null && firstRow !== undefined && (
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
          data-pending=""
          {...stylex.props(styles.pending)}
          style={{
            left: pendingNote.x - 2,
            top: pendingNote.y - 2,
            width: pendingNote.width + 4,
            height: pendingNote.height + 4,
          }}
        />
      )}
      {active?.kind === 'box' && firstRow !== undefined && lastRow !== undefined && (
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
