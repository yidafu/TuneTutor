/**
 * Position utilities for note finding and positioning
 */

import type { NotePosition } from '../../types/notation';
import type { NoteBounds } from '../../core/types';
import { noteCache } from '../../core';

/**
 * Get the positions of all rendered notes
 * @returns Array of note positions with measure and note indices
 */
export function getNotePositions(): NotePosition[] {
  return noteCache.getAll().map(({ measureIndex, noteIndex, x, y, width, height }) => ({
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
export function findNoteAtPosition(x: number, y: number): NoteBounds | null {
  return noteCache.findByPosition(x, y) ?? null;
}
