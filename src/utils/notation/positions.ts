/**
 * Position utilities for note finding and positioning
 */

import type { NotePosition } from '../../types/notation';
import { noteBoundsCache } from './types';

/**
 * Get the positions of all rendered notes
 * @returns Array of note positions with measure and note indices
 */
export function getNotePositions(): NotePosition[] {
  return noteBoundsCache.map(({ measureIndex, noteIndex, x, y, width, height }) => ({
    measureIndex,
    noteIndex,
    x,
    y,
    width,
    height,
  }));
}

/**
 * Find note at given position
 * @param x X coordinate
 * @param y Y coordinate
 * @returns NoteBounds if found, null otherwise
 */
export function findNoteAtPosition(x: number, y: number): typeof noteBoundsCache[0] | null {
  for (const note of noteBoundsCache) {
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
