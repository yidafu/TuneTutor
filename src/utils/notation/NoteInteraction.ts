/**
 * Note interaction utilities for OSMD
 */

import { getOsmdInstance } from './OsmdRender';

export interface NoteBounds {
  measureIndex: number;
  noteIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Access OSMD internal structures
interface GraphicSheet {
  Measures: unknown[];
}

interface GraphicMeasure {
  StaffEntries: unknown[];
}

interface GraphicStaffEntry {
  VoiceEntries: unknown[];
}

interface GraphicVoiceEntry {
  notes: unknown[];
}

interface NotePosition {
  x: number;
  y: number;
}

interface BoundingBox {
  AbsolutePosition: NotePosition;
  Width: number;
  Height: number;
}

/**
 * Get all note positions from the rendered score
 */
export function getOsmdNotePositions(): NoteBounds[] {
  const osmd = getOsmdInstance();
  if (!osmd) {
    return [];
  }

  const notes: NoteBounds[] = [];

  try {
    // Access graphic through type casting
    const graphic = osmd as unknown as { graphic: GraphicSheet };
    if (!graphic?.graphic) {
      return [];
    }

    const measures = graphic.graphic.Measures;
    if (!measures) {
      return [];
    }

    for (let m = 0; m < measures.length; m++) {
      const measure = measures[m] as GraphicMeasure | undefined;
      if (!measure) continue;

      const staffEntries = measure.StaffEntries;
      if (!staffEntries) continue;

      for (let s = 0; s < staffEntries.length; s++) {
        const staffEntry = staffEntries[s] as GraphicStaffEntry | undefined;
        if (!staffEntry) continue;

        const voiceEntries = staffEntry.VoiceEntries;
        if (!voiceEntries) continue;

        for (let v = 0; v < voiceEntries.length; v++) {
          const voiceEntry = voiceEntries[v] as GraphicVoiceEntry | undefined;
          if (!voiceEntry) continue;

          const graphicalNotes = voiceEntry.notes;
          if (!graphicalNotes) continue;

          for (let n = 0; n < graphicalNotes.length; n++) {
            const graphicalNote = graphicalNotes[n] as { PositionAndShape?: BoundingBox } | undefined;
            if (!graphicalNote) continue;

            const box = graphicalNote.PositionAndShape;
            if (!box) continue;

            notes.push({
              measureIndex: m,
              noteIndex: n,
              x: box.AbsolutePosition.x,
              y: box.AbsolutePosition.y,
              width: box.Width,
              height: box.Height,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting note positions:', error);
  }

  return notes;
}

/**
 * Find note at given position
 */
export function findOsmdNoteAtPosition(x: number, y: number): NoteBounds | null {
  const notes = getOsmdNotePositions();

  for (const note of notes) {
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
 * Get total number of notes
 */
export function getOsmdTotalNotes(): number {
  return getOsmdNotePositions().length;
}

/**
 * Get total number of measures
 */
export function getOsmdTotalMeasures(): number {
  const osmd = getOsmdInstance();
  if (!osmd) {
    return 0;
  }

  try {
    const graphic = osmd as unknown as { graphic: GraphicSheet };
    return graphic?.graphic?.Measures?.length ?? 0;
  } catch {
    return 0;
  }
}