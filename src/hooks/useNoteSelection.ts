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
import type { SelectedNote, SelectionRange, SelectionRect, NotePosition } from '../types/notation';

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

  // 框选状态（2D 矩形）
  selectionRect: SelectionRect | null;
  isBoxSelecting: boolean;

  // 交互状态
  anchorNote: SelectedNote | null; // Shift+点击的锚点

  // 小节级别选择状态（兼容 App.tsx）
  selectedMeasures: number[];
  anchorMeasure: number | null;
  isMeasureRangeSelecting: boolean;
}

/**
 * 选择操作
 */
export interface NoteSelectionActions {
  // ========== 范围选择（X轴拖拽） ==========
  startRangeSelection: (x: number) => void;
  updateRangeSelection: (x: number) => void;
  endRangeSelection: () => void;
  moveRangeHandle: (handle: 'start' | 'end', x: number) => void;
  setActiveHandle: (handle: 'start' | 'end' | null) => void;

  // ========== 框选（2D 矩形） ==========
  startBoxSelection: (x: number, y: number) => void;
  updateBoxSelection: (x: number, y: number) => void;
  endBoxSelection: () => void;

  // ========== 单个音符选择 ==========
  selectNote: (note: SelectedNote, mode: SelectionModeType, isShiftPressed: boolean) => void;
  toggleNote: (note: SelectedNote) => void;

  // ========== 范围音符选择（Shift+点击） ==========
  selectNoteRange: (startNote: SelectedNote, endNote: SelectedNote, mode: SelectionModeType) => void;

  // ========== 小节级别选择（兼容 App.tsx） ==========
  selectMeasure: (measureIndex: number, addToSelection?: boolean) => void;
  toggleMeasure: (measureIndex: number) => void;
  selectRange: (startMeasure: number, endMeasure: number) => void;

  // ========== 批量操作 ==========
  selectNotes: (notes: SelectedNote[], mode: SelectionModeType) => void;
  clearSelection: () => void;

  // ========== 辅助方法 ==========
  getNotesInRange: (range: SelectionRange, notePositions: NotePosition[]) => SelectedNote[];
  getNotesInRect: (rect: SelectionRect, notePositions: NotePosition[]) => SelectedNote[];
  isNoteSelected: (measureIndex: number, noteIndex: number) => boolean;
  isMeasureSelected: (measureIndex: number) => boolean;
}

/**
 * 统一的音符选择 Hook
 */
export function useNoteSelection(
  totalMeasures: number = 8,
  initialSelection: number[] = []
): [NoteSelectionState, NoteSelectionActions] {
  // ========== 状态定义 ==========
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [anchorNote, setAnchorNote] = useState<SelectedNote | null>(null);

  // 小节级别选择状态（兼容 App.tsx）
  const [selectedMeasures, setSelectedMeasures] = useState<number[]>(initialSelection);
  const [anchorMeasure, setAnchorMeasure] = useState<number | null>(null);
  const [isMeasureRangeSelecting, setIsMeasureRangeSelecting] = useState(false);

  // ========== Refs ==========
  const initialXRef = useRef<number | null>(null);
  const initialPointRef = useRef<{ x: number; y: number } | null>(null);

  // ========== 辅助函数：检查音符是否在选择范围内 ==========
  const isNoteInRange = useCallback((note: NotePosition, range: SelectionRange): boolean => {
    const noteLeft = note.x;
    const noteRight = note.x + note.width;
    const rangeLeft = Math.min(range.startX, range.endX);
    const rangeRight = Math.max(range.startX, range.endX);

    // 检查音符边界框是否与选择范围重叠
    return noteRight >= rangeLeft && noteLeft <= rangeRight;
  }, []);

  // ========== 辅助函数：检查音符是否在矩形框内 ==========
  const isNoteInRect = useCallback((note: NotePosition, rect: SelectionRect): boolean => {
    const normalized = normalizeRect(rect);
    return (
      note.x >= normalized.x &&
      note.x + note.width <= normalized.x + normalized.width &&
      note.y >= normalized.y &&
      note.y + note.height <= normalized.y + normalized.height
    );
  }, []);

  // ========== 范围选择实现 ==========
  const startRangeSelection = useCallback((x: number) => {
    initialXRef.current = x;
    setSelectionRange({ startX: x, endX: x });
    setIsRangeSelecting(true);
    setActiveHandle(null);
  }, []);

  const updateRangeSelection = useCallback((x: number) => {
    if (!initialXRef.current) return;

    const startX = Math.min(initialXRef.current, x);
    const endX = Math.max(initialXRef.current, x);

    setSelectionRange({ startX, endX });
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

  // ========== 框选实现 ==========
  const startBoxSelection = useCallback((x: number, y: number) => {
    initialPointRef.current = { x, y };
    setSelectionRect({ x, y, width: 0, height: 0 });
    setIsBoxSelecting(true);
  }, []);

  const updateBoxSelection = useCallback((x: number, y: number) => {
    if (!initialPointRef.current) return;

    const newRect = normalizeRect({
      x: initialPointRef.current.x,
      y: initialPointRef.current.y,
      width: x - initialPointRef.current.x,
      height: y - initialPointRef.current.y,
    });

    setSelectionRect(newRect);
  }, []);

  const endBoxSelection = useCallback(() => {
    setIsBoxSelecting(false);
    initialPointRef.current = null;
  }, []);

  // ========== 单个音符选择 ==========
  const selectNote = useCallback((
    note: SelectedNote,
    mode: SelectionModeType,
    isShiftPressed: boolean
  ) => {
    if (isShiftPressed && anchorNote) {
      // Shift+点击：从锚点范围选择
      selectNoteRange(anchorNote, note, mode);
    } else if (mode === 'toggle') {
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
  }, [anchorNote]);

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

  // ========== 范围音符选择（Shift+点击） ==========
  const selectNoteRange = useCallback((
    startNote: SelectedNote,
    endNote: SelectedNote,
    mode: SelectionModeType
  ) => {
    // 根据 measureIndex 和 noteIndex 生成范围
    // 简化实现：只处理相邻小节的音符
    const startM = Math.min(startNote.measureIndex, endNote.measureIndex);
    const endM = Math.max(startNote.measureIndex, endNote.measureIndex);

    const notes: SelectedNote[] = [];
    for (let m = startM; m <= endM; m++) {
      notes.push({ measureIndex: m, noteIndex: 0 });
    }

    if (mode === 'replace') {
      setSelectedNotes(notes);
    } else {
      // Add 模式：合并现有选择
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
    setSelectedMeasures([]);
    setSelectionRange(null);
    setSelectionRect(null);
    setIsRangeSelecting(false);
    setIsBoxSelecting(false);
    setIsMeasureRangeSelecting(false);
    setActiveHandle(null);
    setAnchorMeasure(null);
    setAnchorNote(null);
  }, []);

  // ========== 小节级别选择方法（兼容 App.tsx） ==========
  const isMeasureSelected = useCallback(
    (measureIndex: number): boolean => {
      return selectedMeasures.includes(measureIndex);
    },
    [selectedMeasures]
  );

  const selectMeasure = useCallback(
    (measureIndex: number, addToSelection: boolean = false) => {
      // Validate measure index
      if (measureIndex < 0 || measureIndex >= totalMeasures) return;

      if (addToSelection && anchorMeasure !== null) {
        // Range selection with Shift
        const start = Math.min(anchorMeasure, measureIndex);
        const end = Math.max(anchorMeasure, measureIndex);
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setSelectedMeasures(range);
        setIsMeasureRangeSelecting(true);
      } else if (addToSelection) {
        // Add to selection with Ctrl/Cmd (without anchor)
        if (!selectedMeasures.includes(measureIndex)) {
          setSelectedMeasures([...selectedMeasures, measureIndex]);
        }
        setAnchorMeasure(measureIndex);
      } else {
        // Single selection (click without modifier)
        if (selectedMeasures.includes(measureIndex)) {
          // Deselect if already selected
          setSelectedMeasures(selectedMeasures.filter((m) => m !== measureIndex));
        } else {
          setSelectedMeasures([measureIndex]);
        }
        setAnchorMeasure(measureIndex);
        setIsMeasureRangeSelecting(false);
      }
    },
    [selectedMeasures, anchorMeasure, totalMeasures]
  );

  const toggleMeasure = useCallback((measureIndex: number) => {
    // Validate measure index
    if (measureIndex < 0 || measureIndex >= totalMeasures) return;

    if (selectedMeasures.includes(measureIndex)) {
      setSelectedMeasures(selectedMeasures.filter((m) => m !== measureIndex));
    } else {
      setSelectedMeasures([...selectedMeasures, measureIndex]);
    }
    setAnchorMeasure(measureIndex);
  }, [selectedMeasures, totalMeasures]);

  const selectRange = useCallback((startMeasure: number, endMeasure: number) => {
    const start = Math.max(0, Math.min(startMeasure, endMeasure));
    const end = Math.min(totalMeasures - 1, Math.max(startMeasure, endMeasure));
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setSelectedMeasures(range);
    setAnchorMeasure(startMeasure);
    setIsMeasureRangeSelecting(true);
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

  const getNotesInRect = useCallback((
    rect: SelectionRect,
    notePositions: NotePosition[]
  ): SelectedNote[] => {
    const normalized = normalizeRect(rect);
    return notePositions
      .filter((note) => isNoteInRect(note, normalized))
      .map((note) => ({ measureIndex: note.measureIndex, noteIndex: note.noteIndex }));
  }, [isNoteInRect]);

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
      selectionRect,
      isBoxSelecting,
      anchorNote,
      selectedMeasures,
      anchorMeasure,
      isMeasureRangeSelecting,
    }),
    [selectedNotes, selectionRange, isRangeSelecting, activeHandle, selectionRect, isBoxSelecting, anchorNote, selectedMeasures, anchorMeasure, isMeasureRangeSelecting]
  );

  const actions: NoteSelectionActions = useMemo(
    () => ({
      startRangeSelection,
      updateRangeSelection,
      endRangeSelection,
      moveRangeHandle,
      setActiveHandle,
      startBoxSelection,
      updateBoxSelection,
      endBoxSelection,
      selectNote,
      toggleNote,
      selectNoteRange,
      selectMeasure,
      toggleMeasure,
      selectRange,
      selectNotes,
      clearSelection,
      getNotesInRange,
      getNotesInRect,
      isNoteSelected,
      isMeasureSelected,
    }),
    [startRangeSelection, updateRangeSelection, endRangeSelection, moveRangeHandle, setActiveHandle, startBoxSelection, updateBoxSelection, endBoxSelection, selectNote, toggleNote, selectNoteRange, selectMeasure, toggleMeasure, selectRange, selectNotes, clearSelection, getNotesInRange, getNotesInRect, isNoteSelected, isMeasureSelected]
  );

  return [state, actions];
}

// ========== 内部辅助函数 ==========

function normalizeRect(rect: SelectionRect): SelectionRect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  return { x, y, width, height };
}

export default useNoteSelection;
