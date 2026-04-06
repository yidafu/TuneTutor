/**
 * NoteCoordinateMapper - 音符坐标映射中间层
 * 管理音符与坐标映射关系，输入坐标获取选中音符，输出给播放器
 */

import type { NoteBounds, RowConfig } from '../../core/types';
import type { SelectedNote, SelectionRange, NotePosition, ParsedScore, Note } from '../../types/notation';
import type { SelectionRect } from '../../types/selection';
import { noteCache, rowCache } from '../../core';
import { STAVE_HEIGHT, VERTICAL_OFFSET } from '../../core';

/**
 * 坐标范围输入
 */
export interface CoordinateRange {
  startX: number;
  endX: number;
  startY?: number;
  endY?: number;
}

/**
 * 高亮区域输出（用于 UI 渲染）
 */
export interface HighlightRegion {
  rowIndex: number;
  startX: number;
  endX: number;
  rowY: number;
  rowHeight: number;
}

/**
 * 音符坐标映射器
 * 统一管理音符与坐标的映射关系
 */
class NoteCoordinateMapperClass {
  /**
   * 同步音符边界数据（从 VexFlow 渲染后获取）
   * @param notes 音符边界数组
   */
  syncNoteBounds(notes: NoteBounds[]): void {
    // 更新全局缓存
    noteCache.set(notes);
  }

  /**
   * 同步行配置数据
   * @param configs 行配置数组
   */
  syncRowConfigs(configs: RowConfig[]): void {
    rowCache.set(configs);
  }

  /**
   * 获取所有音符位置
   */
  getAllNotePositions(): NotePosition[] {
    return noteCache.map(({ measureIndex, noteIndex, x, y, width, height }) => ({
      measureIndex,
      noteIndex,
      x,
      y,
      width,
      height,
    }));
  }

  /**
   * 核心：根据坐标范围获取选中的音符
   * @param range 坐标范围
   * @returns 选中的音符列表
   */
  getNotesInCoordinateRange(range: CoordinateRange): NoteBounds[] {
    const startX = Math.min(range.startX, range.endX);
    const endX = Math.max(range.startX, range.endX);
    const startY = range.startY;
    const endY = range.endY;

    // 如果有 Y 坐标，确定起始行
    const startRowIndex = startY !== undefined ? this.findRowIndexByY(startY) : 0;
    const endRowIndex = endY !== undefined ? this.findRowIndexByY(endY) : startRowIndex;

    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);

    return noteCache.filter(note => {
      // 行范围过滤
      if (note.rowIndex < minRow || note.rowIndex > maxRow) return false;

      // X 坐标范围过滤
      const noteStart = note.x;
      const noteEnd = note.x + note.width;
      const inXRange = noteEnd >= startX && noteStart <= endX;
      if (!inXRange) return false;

      // 如果有起始行 Y 坐标，只选择起始行的音符
      if (startY !== undefined) {
        const rowConfig = rowCache.find(r => r.rowIndex === note.rowIndex);
        if (rowConfig) {
          const rowTop = rowConfig.y + VERTICAL_OFFSET;
          const rowBottom = rowConfig.y + STAVE_HEIGHT - VERTICAL_OFFSET;
          const noteTop = note.y;
          const noteBottom = note.y + note.height;
          return noteBottom >= rowTop && noteTop <= rowBottom;
        }
      }

      return true;
    });
  }

  /**
   * 单点查询：获取点击的音符
   */
  getNoteAtPosition(x: number, y: number): NoteBounds | null {
    for (const note of noteCache) {
      if (
        x >= note.x &&
        x <= note.x + note.width &&
        y >= note.y &&
        y <= note.y + note.height
      ) {
        return note;
      }
    }
    return null;
  }

  /**
   * 根据坐标找到对应的行索引
   */
  findRowIndexByY(y: number): number {
    for (const row of rowCache) {
      const rowTop = row.y + VERTICAL_OFFSET;
      const rowBottom = row.y + STAVE_HEIGHT - VERTICAL_OFFSET;
      if (y >= rowTop && y <= rowBottom) {
        return row.rowIndex;
      }
    }
    return 0;
  }

  /**
   * 根据起始和结束音符获取范围内的所有音符（跨行支持）
   */
  getNotesBetween(startNote: NoteBounds, endNote: NoteBounds): NoteBounds[] {
    const startIdx = noteCache.findIndex(
      n => n.measureIndex === startNote.measureIndex && n.noteIndex === startNote.noteIndex
    );
    const endIdx = noteCache.findIndex(
      n => n.measureIndex === endNote.measureIndex && n.noteIndex === endNote.noteIndex
    );

    if (startIdx === -1 || endIdx === -1) return [];

    return noteCache.slice(
      Math.min(startIdx, endIdx),
      Math.max(startIdx, endIdx) + 1
    );
  }

  /**
   * 计算选中音符的高亮区域（供 UI 渲染）
   */
  getHighlightRegions(notes: NoteBounds[]): HighlightRegion[] {
    if (notes.length === 0 || rowCache.length === 0) return [];

    // 按行分组
    const notesByRow = new Map<number, NoteBounds[]>();
    for (const note of notes) {
      const rowNotes = notesByRow.get(note.rowIndex) || [];
      rowNotes.push(note);
      notesByRow.set(note.rowIndex, rowNotes);
    }

    const regions: HighlightRegion[] = [];

    for (const [rowIndex, rowNotes] of notesByRow) {
      const rowConfig = rowCache.find(r => r.rowIndex === rowIndex);
      if (!rowConfig) continue;

      const minX = Math.min(...rowNotes.map(n => n.x));
      const maxX = Math.max(...rowNotes.map(n => n.x + n.width));

      regions.push({
        rowIndex,
        startX: minX - 4,
        endX: maxX + 4,
        rowY: rowConfig.y,
        rowHeight: STAVE_HEIGHT,
      });
    }

    return regions;
  }

  /**
   * 计算基于音符的跨行选择矩形
   */
  getSelectionRects(startNote: NoteBounds, endNote: NoteBounds): SelectionRect[] {
    const rects: SelectionRect[] = [];

    const startRow = Math.min(startNote.rowIndex, endNote.rowIndex);
    const endRow = Math.max(startNote.rowIndex, endNote.rowIndex);

    for (let row = startRow; row <= endRow; row++) {
      const rowConfig = rowCache.find(r => r.rowIndex === row);
      if (!rowConfig) continue;

      const rowY = rowConfig.y;
      const rowNotes = noteCache.filter(n => n.rowIndex === row);

      if (rowNotes.length === 0) continue;

      let rowStartNote: NoteBounds;
      let rowEndNote: NoteBounds;

      if (row === startRow && row === endRow) {
        if (startNote.x <= endNote.x) {
          rowStartNote = startNote;
          rowEndNote = endNote;
        } else {
          rowStartNote = endNote;
          rowEndNote = startNote;
        }
      } else if (row === startRow) {
        rowStartNote = startNote.rowIndex === row ? startNote : rowNotes[0];
        rowEndNote = rowNotes[rowNotes.length - 1];
      } else if (row === endRow) {
        rowStartNote = rowNotes[0];
        rowEndNote = endNote.rowIndex === row ? endNote : rowNotes[rowNotes.length - 1];
      } else {
        rowStartNote = rowNotes[0];
        rowEndNote = rowNotes[rowNotes.length - 1];
      }

      rects.push({
        startX: rowStartNote.x,
        endX: rowEndNote.x + rowEndNote.width,
        rowIndex: row,
        rowY,
        rowHeight: STAVE_HEIGHT,
      });
    }

    return rects;
  }

  /**
   * 桥接播放器：将 SelectedNote 转换为实际 Note 数据
   * @param selectedNotes 选中的音符标识列表
   * @param score 乐谱数据
   * @returns 可播放的 Note 列表
   */
  getPlaybackNotes(selectedNotes: SelectedNote[], score: ParsedScore): Note[] {
    if (!score || !score.measures) return [];

    const notes: Note[] = [];

    for (const selected of selectedNotes) {
      const measure = score.measures[selected.measureIndex];
      if (!measure) continue;

      const note = measure.notes[selected.noteIndex];
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Get playback notes with position info for indicator animation
   * Returns notes that include their measureIndex and noteIndex for position tracking
   */
  getPlaybackNotesWithPosition(selectedNotes: SelectedNote[], score: ParsedScore): Array<Note & { measureIndex: number; noteIndex: number }> {
    if (!score || !score.measures) return [];

    const notes: Array<Note & { measureIndex: number; noteIndex: number }> = [];

    for (const selected of selectedNotes) {
      const measure = score.measures[selected.measureIndex];
      if (!measure) continue;

      const note = measure.notes[selected.noteIndex];
      if (note) {
        notes.push({ ...note, measureIndex: selected.measureIndex, noteIndex: selected.noteIndex });
      }
    }

    return notes;
  }

  /**
   * 根据选中的音符获取对应的 NoteBounds（用于高亮计算）
   */
  getSelectedNoteBounds(selectedNotes: SelectedNote[]): NoteBounds[] {
    return selectedNotes
      .map(({ measureIndex, noteIndex }) =>
        noteCache.find(n => n.measureIndex === measureIndex && n.noteIndex === noteIndex)
      )
      .filter((n): n is NoteBounds => n !== undefined);
  }

  /**
   * 从 SelectionRange 转换为 CoordinateRange
   */
  rangeToCoordinateRange(range: SelectionRange): CoordinateRange {
    return {
      startX: range.startX,
      endX: range.endX,
      startY: range.startY,
      endY: range.endY,
    };
  }

  /**
   * 获取音符的位置信息（用于播放指示器定位）
   * @param measureIndex 小节索引
   * @param noteIndex 音符索引
   * @returns 音符的 NoteBounds 或 undefined
   */
  getNotePosition(measureIndex: number, noteIndex: number): NoteBounds | undefined {
    return noteCache.find(
      n => n.measureIndex === measureIndex && n.noteIndex === noteIndex
    );
  }
}

// 单例导出
let noteCoordinateMapper: NoteCoordinateMapperClass | null = null;

export function getNoteCoordinateMapper(): NoteCoordinateMapperClass {
  if (!noteCoordinateMapper) {
    noteCoordinateMapper = new NoteCoordinateMapperClass();
  }
  return noteCoordinateMapper;
}

// 导出类用于测试
export { NoteCoordinateMapperClass };