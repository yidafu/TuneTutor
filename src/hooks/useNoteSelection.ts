/**
 * useNoteSelection Hook - 统一的音符选择逻辑
 *
 * 支持：
 * - X轴范围拖拽选择（带左右句柄）
 * - 单个音符点击选择
 * - Shift+点击范围选择
 * - 框选支持（2D矩形）
 * - 小节级别选择（measure selection）
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { SelectedNote, SelectionRange, NotePosition } from '../types/notation';
import type { RowConfig, RowHighlight, RowSelection } from '../types/selection';
import { getSelectionRects, noteBoundsCache, rowConfigsCache } from '../utils/notation';
import { STAVE_HEIGHT, VERTICAL_OFFSET, ROW_SPACING, TOP_Y } from '../utils/notation/types';

// 常量
const MIN_HANDLE_DISTANCE = 20; // 句柄最小距离

/**
 * 选择模式类型
 */
export type SelectionModeType = 'replace' | 'add' | 'toggle';

/**
 * 选择状态
 */
export interface NoteSelectionState {
  // 已选中的音符
  selectedNotes: SelectedNote[];

  // 范围选择状态（X轴拖拽）
  selectionRange: SelectionRange | null;
  isRangeSelecting: boolean;
  activeHandle: 'start' | 'end' | null;

  // 交互状态
  anchorNote: SelectedNote | null; // 点击的锚点

  // 竖线拖动状态（二次调整选择范围）
  selectionLeftX: number | null;   // 左竖线 X 坐标
  selectionRightX: number | null;  // 右竖线 X 坐标
  isLeftBarDragging: boolean;      // 是否正在拖动左竖线
  isRightBarDragging: boolean;     // 是否正在拖动右竖线
}

/**
 * 选择操作
 */
export interface NoteSelectionActions {
  // ========== 范围选择（X轴拖拽） ==========
  startRangeSelection: (x: number, y?: number, startNote?: SelectedNote) => void;
  updateRangeSelection: (x: number, y?: number, endNote?: SelectedNote) => void;
  endRangeSelection: () => void;
  moveRangeHandle: (handle: 'start' | 'end', x: number) => void;
  setActiveHandle: (handle: 'start' | 'end' | null) => void;

  // ========== 单个音符选择 ==========
  selectNote: (note: SelectedNote, mode: SelectionModeType, isShiftPressed: boolean) => void;
  toggleNote: (note: SelectedNote) => void;

  // ========== 小节级别选择 ==========
  selectMeasure: (measureIndex: number, addToSelection?: boolean) => void;
  toggleMeasure: (measureIndex: number) => void;

  // ========== 批量操作 ==========
  selectNotes: (notes: SelectedNote[], mode: SelectionModeType) => void;
  clearSelection: () => void;

  // ========== 辅助方法 ==========
  getNotesInRange: (range: SelectionRange, notePositions: NotePosition[]) => SelectedNote[];
  isNoteSelected: (measureIndex: number, noteIndex: number) => boolean;

  // ========== 竖线拖动（二次调整选择范围） ==========
  startLeftBarDrag: (x: number) => void;
  startRightBarDrag: (x: number) => void;
  updateBarDrag: (x: number) => void;
  endBarDrag: () => void;
  setSelectionBounds: (leftX: number, rightX: number) => void;
}

/**
 * 统一的音符选择 Hook
 */
export function useNoteSelection(
  totalMeasures: number = 8,
  _initialSelection: number[] = []
): [NoteSelectionState, NoteSelectionActions] {
  // ========== 状态定义 ==========
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [anchorNote, setAnchorNote] = useState<SelectedNote | null>(null);

  // 竖线拖动状态（二次调整选择范围）
  const [selectionLeftX, setSelectionLeftX] = useState<number | null>(null);
  const [selectionRightX, setSelectionRightX] = useState<number | null>(null);
  const [isLeftBarDragging, setIsLeftBarDragging] = useState(false);
  const [isRightBarDragging, setIsRightBarDragging] = useState(false);

  // ========== Refs ==========
  const initialXRef = useRef<number | null>(null);

  // ========== 辅助函数：检查音符是否在选择范围内 ==========
  const isNoteInRange = useCallback((note: NotePosition, range: SelectionRange): boolean => {
    const noteLeft = note.x;
    const noteRight = note.x + note.width;
    const rangeLeft = Math.min(range.startX, range.endX);
    const rangeRight = Math.max(range.startX, range.endX);

    // 检查 X 坐标重叠
    const inXRange = noteRight >= rangeLeft && noteLeft <= rangeRight;
    if (!inXRange) return false;

    // 如果提供了起始行的 Y 坐标，只选择起始行的音符
    if (range.startY !== undefined) {
      // 五线谱行高约为 80px，计算起始行的大致 Y 范围
      const rowHeight = STAVE_HEIGHT;

      // 计算起始行的 Y 范围（以 startY 为中心）
      const startRowTop = range.startY;
      const startRowBottom = range.startY + rowHeight;

      // 检查音符是否在起始行的 Y 范围内
      const noteTop = note.y;
      const noteBottom = note.y + note.height;

      // 只选择 Y 坐标在起始行范围内的音符
      return noteBottom >= startRowTop && noteTop <= startRowBottom;
    }

    return true;
  }, []);

  // ========== 范围选择实现 ==========
  const startRangeSelection = useCallback((x: number, y?: number, startNote?: SelectedNote) => {
    initialXRef.current = x;
    setSelectionRange({ startX: x, endX: x, startY: y, endY: y, startNote, endNote: startNote });
    setIsRangeSelecting(true);
    setActiveHandle(null);
  }, []);

  const updateRangeSelection = useCallback((x: number, y?: number, endNote?: SelectedNote) => {
    if (!initialXRef.current) return;

    const startX = Math.min(initialXRef.current, x);
    const endX = Math.max(initialXRef.current, x);

    setSelectionRange((prev) => {
      if (!prev) return { startX, endX, startY: y, endY: y, startNote: endNote, endNote };
      return {
        startX,
        endX,
        startY: prev.startY,
        endY: y,
        startNote: prev.startNote,
        endNote,
      };
    });
  }, []);

  const endRangeSelection = useCallback(() => {
    setIsRangeSelecting(false);
    setActiveHandle(null);
    initialXRef.current = null;
  }, []);

  const moveRangeHandle = useCallback((handle: 'start' | 'end', x: number) => {
    setSelectionRange((prev) => {
      if (!prev) return null;

      const otherHandle = handle === 'start' ? prev.endX : prev.startX;
      let newStartX = prev.startX;
      let newEndX = prev.endX;

      if (handle === 'start') {
        newStartX = Math.min(x, otherHandle - MIN_HANDLE_DISTANCE);
      } else {
        newEndX = Math.max(x, otherHandle + MIN_HANDLE_DISTANCE);
      }

      return { startX: newStartX, endX: newEndX };
    });
    setActiveHandle(handle);
  }, []);

  // ========== 竖线拖动（二次调整选择范围） ==========
  const startLeftBarDrag = useCallback((_x: number) => {
    setIsLeftBarDragging(true);
    setIsRightBarDragging(false);
  }, []);

  const startRightBarDrag = useCallback((_x: number) => {
    setIsRightBarDragging(true);
    setIsLeftBarDragging(false);
  }, []);

  const updateBarDrag = useCallback((x: number) => {
    if (isLeftBarDragging) {
      setSelectionLeftX(x);
    } else if (isRightBarDragging) {
      setSelectionRightX(x);
    }
  }, [isLeftBarDragging, isRightBarDragging]);

  const endBarDrag = useCallback(() => {
    setIsLeftBarDragging(false);
    setIsRightBarDragging(false);
  }, []);

  const setSelectionBounds = useCallback((leftX: number, rightX: number) => {
    setSelectionLeftX(leftX);
    setSelectionRightX(rightX);
  }, []);

  // ========== 单个音符选择 ==========
  const selectNote = useCallback((
    note: SelectedNote,
    mode: SelectionModeType,
    _isShiftPressed: boolean
  ) => {
    if (mode === 'toggle') {
      // Ctrl+点击：切换选择
      setSelectedNotes((prev) => {
        const exists = prev.some(
          (n) => n.measureIndex === note.measureIndex && n.noteIndex === note.noteIndex
        );
        if (exists) {
          return prev.filter(
            (n) => !(n.measureIndex === note.measureIndex && n.noteIndex === note.noteIndex)
          );
        }
        return [...prev, note];
      });
    } else {
      // 普通点击：替换选择
      setSelectedNotes([note]);
    }
    setAnchorNote(note);
  }, []);

  const toggleNote = useCallback((note: SelectedNote) => {
    setSelectedNotes((prev) => {
      const exists = prev.some(
        (n) => n.measureIndex === note.measureIndex && n.noteIndex === note.noteIndex
      );
      if (exists) {
        return prev.filter(
          (n) => !(n.measureIndex === note.measureIndex && n.noteIndex === note.noteIndex)
        );
      }
      return [...prev, note];
    });
  }, []);

  // ========== 批量操作 ==========
  const selectNotes = useCallback((notes: SelectedNote[], mode: SelectionModeType) => {
    if (mode === 'replace') {
      setSelectedNotes(notes);
    } else {
      // Add 模式
      setSelectedNotes((prev) => {
        const existingSet = new Set(
          prev.map((n) => `${n.measureIndex}-${n.noteIndex}`)
        );
        const newNotes = notes.filter(
          (n) => !existingSet.has(`${n.measureIndex}-${n.noteIndex}`)
        );
        return [...prev, ...newNotes];
      });
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNotes([]);
    setSelectionRange(null);
    setIsRangeSelecting(false);
    setActiveHandle(null);
    setAnchorNote(null);
    setSelectionLeftX(null);
    setSelectionRightX(null);
    setIsLeftBarDragging(false);
    setIsRightBarDragging(false);
  }, []);

  // ========== 小节级别选择方法 ==========
  const selectMeasure = useCallback(
    (measureIndex: number, addToSelection: boolean = false) => {
      // Validate measure index
      if (measureIndex < 0 || measureIndex >= totalMeasures) return;

      // Select all notes in this measure (simplified - assumes first note per measure)
      const newSelection: SelectedNote[] = [{ measureIndex, noteIndex: 0 }];

      if (addToSelection && anchorNote !== null) {
        // Range selection with Shift: select from anchor to target measure
        const startM = Math.min(anchorNote.measureIndex, measureIndex);
        const endM = Math.max(anchorNote.measureIndex, measureIndex);
        const rangeNotes: SelectedNote[] = [];
        for (let m = startM; m <= endM; m++) {
          rangeNotes.push({ measureIndex: m, noteIndex: 0 });
        }
        setSelectedNotes(prev => [...prev, ...rangeNotes]);
      } else if (addToSelection) {
        // Add to selection with Ctrl/Cmd (without anchor)
        setSelectedNotes(prev => {
          const exists = prev.some(n => n.measureIndex === measureIndex);
          if (exists) return prev;
          return [...prev, ...newSelection];
        });
        setAnchorNote(newSelection[0]);
      } else {
        // Single selection (click without modifier)
        setSelectedNotes(newSelection);
        setAnchorNote(newSelection[0]);
      }
    },
    [anchorNote, totalMeasures]
  );

  const toggleMeasure = useCallback((measureIndex: number) => {
    // Validate measure index
    if (measureIndex < 0 || measureIndex >= totalMeasures) return;

    // Toggle all notes in this measure
    const noteToToggle: SelectedNote = { measureIndex, noteIndex: 0 };
    setSelectedNotes(prev => {
      const exists = prev.some(n => n.measureIndex === measureIndex);
      if (exists) {
        return prev.filter(n => n.measureIndex !== measureIndex);
      }
      return [...prev, noteToToggle];
    });
    setAnchorNote(noteToToggle);
  }, [totalMeasures]);

  // ========== 辅助方法 ==========
  const getNotesInRange = useCallback((
    range: SelectionRange,
    notePositions: NotePosition[]
  ): SelectedNote[] => {
    return notePositions
      .filter((note) => isNoteInRange(note, range))
      .map((note) => ({ measureIndex: note.measureIndex, noteIndex: note.noteIndex }));
  }, [isNoteInRange]);

  const isNoteSelected = useCallback(
    (measureIndex: number, noteIndex: number): boolean => {
      return selectedNotes.some(
        (n) => n.measureIndex === measureIndex && n.noteIndex === noteIndex
      );
    },
    [selectedNotes]
  );

  // ========== 返回统一状态和操作 ==========
  const state: NoteSelectionState = useMemo(
    () => ({
      selectedNotes,
      selectionRange,
      isRangeSelecting,
      activeHandle,
      anchorNote,
      selectionLeftX,
      selectionRightX,
      isLeftBarDragging,
      isRightBarDragging,
    }),
    [selectedNotes, selectionRange, isRangeSelecting, activeHandle, anchorNote, selectionLeftX, selectionRightX, isLeftBarDragging, isRightBarDragging]
  );

  const actions: NoteSelectionActions = useMemo(
    () => ({
      startRangeSelection,
      updateRangeSelection,
      endRangeSelection,
      moveRangeHandle,
      setActiveHandle,
      selectNote,
      toggleNote,
      selectMeasure,
      toggleMeasure,
      selectNotes,
      clearSelection,
      getNotesInRange,
      isNoteSelected,
      startLeftBarDrag,
      startRightBarDrag,
      updateBarDrag,
      endBarDrag,
      setSelectionBounds,
    }),
    []
  );

  return [state, actions];
}

// ========== 计算函数（可在组件外部使用）==========

/**
 * 生成行配置
 */
export function generateRowConfigs(
  totalMeasures: number,
  options: { measuresPerRow?: number } = {}
): RowConfig[] {
  const { measuresPerRow = 5 } = options;

  const rows: RowConfig[] = [];
  let currentMeasure = 0;

  while (currentMeasure < totalMeasures) {
    const endMeasure = Math.min(currentMeasure + measuresPerRow - 1, totalMeasures - 1);
    const y = TOP_Y + rows.length * (STAVE_HEIGHT + ROW_SPACING);
    const rowIndex = rows.length;

    rows.push({
      startMeasure: currentMeasure,
      endMeasure,
      rowIndex,
      y,
    });

    currentMeasure = endMeasure + 1;
  }

  return rows;
}

/**
 * 根据 Y 坐标找到对应的行索引
 */
export function findRowIndexByY(y: number): number {
  for (const row of rowConfigsCache) {
    const rowTop = row.y + VERTICAL_OFFSET;
    const rowBottom = row.y + STAVE_HEIGHT - VERTICAL_OFFSET;
    if (y >= rowTop && y <= rowBottom) {
      return row.rowIndex;
    }
  }
  // 如果找不到，返回第一行的索引
  return 0;
}

/**
 * 计算范围选择的高亮行（基于音符位置的跨行选择）
 */
export function calculateRowHighlights(
  selectionRange: SelectionRange | null,
  _rowConfigs: RowConfig[] = []
): RowHighlight[] {
  if (!selectionRange || rowConfigsCache.length === 0) {
    return [];
  }

  const startNote = selectionRange.startNote;
  const endNote = selectionRange.endNote;

  // 如果有 startNote 和 endNote，使用基于音符的跨行选择
  if (startNote && endNote) {
    const startNoteBounds = noteBoundsCache.find(
      n => n.measureIndex === startNote.measureIndex && n.noteIndex === startNote.noteIndex
    );
    const endNoteBounds = noteBoundsCache.find(
      n => n.measureIndex === endNote.measureIndex && n.noteIndex === endNote.noteIndex
    );

    if (startNoteBounds && endNoteBounds) {
      const rects = getSelectionRects(startNoteBounds, endNoteBounds);
      return rects.map(rect => {
        const row = rowConfigsCache.find(r => r.rowIndex === rect.rowIndex);
        if (!row) return null;
        return {
          row,
          lineStartX: rect.startX,
          lineEndX: rect.endX,
        };
      }).filter((item): item is RowHighlight => item !== null);
    }
  }

  // 如果没有 startNote/endNote，使用 startY/endY 基于 X 坐标范围进行选择
  const startX = Math.min(selectionRange.startX, selectionRange.endX);
  const endX = Math.max(selectionRange.startX, selectionRange.endX);
  const startY = selectionRange.startY ?? 0;
  const endY = selectionRange.endY ?? 0;

  // 确定起始行和结束行
  const startRowIndex = findRowIndexByY(startY);
  const endRowIndex = endY ? findRowIndexByY(endY) : startRowIndex;

  // 为每一行计算选择范围
  const result: RowHighlight[] = [];
  const minRow = Math.min(startRowIndex, endRowIndex);
  const maxRow = Math.max(startRowIndex, endRowIndex);

  for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
    const rowConfig = rowConfigsCache.find(r => r.rowIndex === rowIdx);
    if (!rowConfig) continue;

    const rowNotes = noteBoundsCache.filter(n => n.rowIndex === rowIdx);
    if (rowNotes.length === 0) continue;

    // 找到该行中在选择范围内的音符
    const notesInRange = rowNotes.filter(n => {
      const noteStart = n.x;
      const noteEnd = n.x + n.width;
      return noteEnd >= startX && noteStart <= endX;
    });

    if (notesInRange.length === 0) continue;

    const minX = Math.min(...notesInRange.map(n => n.x));
    const maxX = Math.max(...notesInRange.map(n => n.x + n.width));

    result.push({
      row: rowConfig,
      lineStartX: minX,
      lineEndX: maxX,
    });
  }

  return result;
}

/**
 * 计算选中音符的高亮行
 */
export function calculateRowSelections(
  selectedNotes: SelectedNote[],
  rowConfigs: RowConfig[],
  getNotePositions: () => NotePosition[],
  options: { staveHeight?: number; verticalOffset?: number } = {}
): RowSelection[] {
  if (selectedNotes.length === 0 || rowConfigs.length === 0) return [];

  const { staveHeight = STAVE_HEIGHT, verticalOffset = VERTICAL_OFFSET } = options;

  // Get all note positions
  const notePositions = getNotePositions();

  // Get selected note positions with their Y coordinates
  const selectedPositions = selectedNotes
    .map(({ measureIndex, noteIndex }) =>
      notePositions.find((n) => n.measureIndex === measureIndex && n.noteIndex === noteIndex)
    )
    .filter(Boolean) as typeof notePositions;

  if (selectedPositions.length === 0) return [];

  // Calculate Y range of all selected notes
  const minY = Math.min(...selectedPositions.map((n) => n.y));
  const maxY = Math.max(...selectedPositions.map((n) => n.y + n.height));

  return rowConfigs
    .map((row) => {
      // Calculate this row's Y bounds (with vertical offset)
      const rowTop = row.y + verticalOffset;
      const rowBottom = row.y + staveHeight - verticalOffset;

      // Check if selection Y range intersects with this row's Y range
      const intersectsRow = maxY >= rowTop && minY <= rowBottom;

      if (!intersectsRow) return null;

      // Get notes that actually fall within this row's Y bounds
      const rowNotes = selectedPositions.filter(
        (n) => n.y + n.height >= rowTop && n.y <= rowBottom
      );

      if (rowNotes.length === 0) return null;

      const minX = Math.min(...rowNotes.map((n) => n.x));
      const maxX = Math.max(...rowNotes.map((n) => n.x + n.width));

      return {
        row,
        lineStartX: minX - 4,
        lineEndX: maxX + 4,
      };
    })
    .filter((item): item is RowSelection => item !== null);
}

export default useNoteSelection;
