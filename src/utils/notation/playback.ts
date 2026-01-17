/**
 * Playback indicator utilities
 */

import type { RowConfig } from './types';
import { STAVE_HEIGHT, VERTICAL_OFFSET } from './types';
import { getNotePositions } from './positions';
import { rowConfigsCache } from './types';

/**
 * Get the playback indicator X position based on current position and progress
 * @param currentMeasure Current measure index
 * @param currentNoteIndex Current note index within the measure
 * @param progressInNote Progress within the current note (0-1)
 * @param isLastNote Whether this is the last note in the playback sequence (optional)
 * @returns The X coordinate for the playback indicator
 */
export function getPlaybackIndicatorX(
  currentMeasure: number,
  currentNoteIndex: number,
  progressInNote: number = 0,
  isLastNote: boolean = false
): number {
  const positions = getNotePositions();

  // Find the current note position
  const currentNotePos = positions.find(
    n => n.measureIndex === currentMeasure && n.noteIndex === currentNoteIndex
  );

  if (!currentNotePos) {
    // If no specific note found, try to find any note in the current measure
    const notesInMeasure = positions.filter(n => n.measureIndex === currentMeasure);
    if (notesInMeasure.length > 0) {
      return notesInMeasure[0].x;
    }
    return 0;
  }

  // Find the current note index in the flat positions array
  const currentNoteIndexInArray = positions.findIndex(
    n => n.measureIndex === currentMeasure && n.noteIndex === currentNoteIndex
  );

  const nextNote = positions[currentNoteIndexInArray + 1];

  // When at the last note in the playback sequence, don't interpolate to the next note
  // even if one exists in the positions array (which might be outside the selection)
  if (nextNote && !isLastNote) {
    // Interpolate between current note end and next note start
    // At progressInNote=0, we're at current note's x position
    // At progressInNote=1, we're at next note's x position
    const startX = currentNotePos.x;
    const endX = nextNote.x;
    return startX + (endX - startX) * progressInNote;
  }

  // No next note OR at last note, interpolate within the current note
  // At progressInNote=0, we're at current note's x position
  // At progressInNote=1, we're at current note's end position
  return currentNotePos.x + currentNotePos.width * progressInNote;
}

/**
 * Get the indicator row bounds (top and bottom Y coordinates)
 * @param measureIndex Current measure index
 * @param rowConfigs Row configurations
 * @returns Object with top and bottom Y coordinates, or null if not found
 */
export function getIndicatorRowBounds(
  measureIndex: number,
  rowConfigs: RowConfig[]
): { top: number; bottom: number } | null {
  const row = rowConfigs.find(
    r => measureIndex >= r.startMeasure && measureIndex <= r.endMeasure
  );

  if (!row) return null;

  const adjustedHeight = STAVE_HEIGHT - VERTICAL_OFFSET;
  return {
    top: row.y + VERTICAL_OFFSET,
    bottom: row.y + adjustedHeight,
  };
}

/**
 * Get row Y coordinate based on row index
 * @param rowIndex Row index
 * @returns Row Y coordinate, or 0 if not found
 */
export function getRowY(rowIndex: number): number {
  const row = rowConfigsCache.find(r => r.rowIndex === rowIndex);
  return row?.y ?? 0;
}
