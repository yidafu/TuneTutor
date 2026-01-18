/**
 * Selection calculation utilities for note selection
 */

import type { NoteBounds } from './types';
import type { SelectionRect } from '../../types/selection';
import { rowConfigsCache, noteBoundsCache, STAVE_HEIGHT } from './types';

/**
 * Get notes within a range defined by start and end notes (cross-row support)
 * @param startNote Starting note
 * @param endNote Ending note
 * @returns Array of notes within the range
 */
export function getNotesInRange(startNote: NoteBounds, endNote: NoteBounds): NoteBounds[] {
  const startIdx = noteBoundsCache.findIndex(
    n => n.measureIndex === startNote.measureIndex && n.noteIndex === startNote.noteIndex
  );
  const endIdx = noteBoundsCache.findIndex(
    n => n.measureIndex === endNote.measureIndex && n.noteIndex === endNote.noteIndex
  );

  if (startIdx === -1 || endIdx === -1) return [];

  return noteBoundsCache.slice(
    Math.min(startIdx, endIdx),
    Math.max(startIdx, endIdx) + 1
  );
}

/**
 * Calculate selection rectangles for cross-row selection
 * @param startNote Starting note
 * @param endNote Ending note
 * @returns Array of SelectionRect for each row
 */
export function getSelectionRects(
  startNote: NoteBounds,
  endNote: NoteBounds
): SelectionRect[] {
  const rects: SelectionRect[] = [];

  const startRow = Math.min(startNote.rowIndex, endNote.rowIndex);
  const endRow = Math.max(startNote.rowIndex, endNote.rowIndex);

  for (let row = startRow; row <= endRow; row++) {
    const rowConfig = rowConfigsCache.find(r => r.rowIndex === row);
    if (!rowConfig) continue;

    const rowY = rowConfig.y;
    const rowNotes = noteBoundsCache.filter(n => n.rowIndex === row);

    if (rowNotes.length === 0) continue;

    let rowStartNote: NoteBounds;
    let rowEndNote: NoteBounds;

    if (row === startRow && row === endRow) {
      // Same row - use actual X positions to determine start/end
      if (startNote.x <= endNote.x) {
        rowStartNote = startNote;
        rowEndNote = endNote;
      } else {
        rowStartNote = endNote;
        rowEndNote = startNote;
      }
    } else if (row === startRow) {
      // Start row: from startNote to last note in row
      rowStartNote = startNote.rowIndex === row ? startNote : rowNotes[0];
      rowEndNote = rowNotes[rowNotes.length - 1];
    } else if (row === endRow) {
      // End row: from first note in row to endNote
      rowStartNote = rowNotes[0];
      rowEndNote = endNote.rowIndex === row ? endNote : rowNotes[rowNotes.length - 1];
    } else {
      // Middle row: full row selection
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
