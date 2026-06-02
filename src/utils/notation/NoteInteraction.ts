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

// OSMD internal structures: MeasureList is GraphicalMeasure[][]
// Outer array = measure containers, inner array = one GraphicalMeasure per staff
interface GraphicMeasureObj {
  staffEntries: GraphicStaffEntryObj[];
}

interface GraphicStaffEntryObj {
  graphicalVoiceEntries: GraphicVoiceEntryObj[];
}

interface GraphicVoiceEntryObj {
  notes: GraphicNoteObj[];
}

interface GraphicNoteObj {
  PositionAndShape?: {
    AbsolutePosition: { x: number; y: number };
    Width: number;
    Height: number;
  };
}

// ---- Caches (invalidated on re-render) ----

let cachedNotePositions: NoteBounds[] | null = null;
let noteElementMap: Map<SVGElement, NoteBounds> | null = null;

/**
 * Invalidate all caches. Call when OSMD clears or re-renders.
 */
export function invalidateNoteCaches(): void {
  cachedNotePositions = null;
  noteElementMap = null;
}

/**
 * Build a Map from SVG .vf-stavenote elements to NoteBounds.
 * Must be called after OSMD renders (SVG elements are in the DOM).
 */
export function buildNoteElementMap(container: HTMLElement): void {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const positions = getOsmdNotePositions();
  const staveNotes = svg.querySelectorAll<SVGElement>('.vf-stavenote');

  noteElementMap = new Map();
  let posIdx = 0;

  for (const el of staveNotes) {
    if (posIdx >= positions.length) break;
    try {
      const bbox = (el as SVGGraphicsElement).getBBox();
      const pos = positions[posIdx];
      if (Math.abs(bbox.x - pos.x) < 5 && Math.abs(bbox.y - pos.y) < 5) {
        noteElementMap.set(el, pos);
        posIdx++;
      }
    } catch {
      // getBBox may throw on detached/hidden elements — skip
    }
  }
}

/**
 * Get all note positions from the rendered score.
 * Result is cached until invalidateNoteCaches() is called.
 */
export function getOsmdNotePositions(): NoteBounds[] {
  if (cachedNotePositions) return cachedNotePositions;

  const osmd = getOsmdInstance();
  if (!osmd) {
    return [];
  }

  const notes: NoteBounds[] = [];

  try {
    const graphic = osmd as unknown as {
      graphic: { measureList: GraphicMeasureObj[][] };
    };
    if (!graphic?.graphic?.measureList) {
      return [];
    }

    const measureList = graphic.graphic.measureList;
    if (!Array.isArray(measureList)) {
      return [];
    }

    let globalNoteIndex = 0;

    for (let m = 0; m < measureList.length; m++) {
      const staffMeasures = measureList[m];
      if (!Array.isArray(staffMeasures)) continue;

      for (let staffIdx = 0; staffIdx < staffMeasures.length; staffIdx++) {
        const measure = staffMeasures[staffIdx] as GraphicMeasureObj | undefined;
        if (!measure) continue;

        const staffEntries = measure.staffEntries;
        if (!staffEntries) continue;

        for (let s = 0; s < staffEntries.length; s++) {
          const staffEntry = staffEntries[s] as GraphicStaffEntryObj | undefined;
          if (!staffEntry) continue;

          const voiceEntries = staffEntry.graphicalVoiceEntries;
          if (!voiceEntries) continue;

          for (let v = 0; v < voiceEntries.length; v++) {
            const voiceEntry = voiceEntries[v] as GraphicVoiceEntryObj | undefined;
            if (!voiceEntry) continue;

            const graphicalNotes = voiceEntry.notes;
            if (!graphicalNotes) continue;

            for (let n = 0; n < graphicalNotes.length; n++) {
              const graphicalNote = graphicalNotes[n] as GraphicNoteObj | undefined;
              if (!graphicalNote) continue;

              const box = graphicalNote.PositionAndShape;
              if (!box) continue;

              notes.push({
                measureIndex: m,
                noteIndex: globalNoteIndex,
                x: box.AbsolutePosition.x,
                y: box.AbsolutePosition.y,
                width: box.Width,
                height: box.Height,
              });
              globalNoteIndex++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting note positions:', error);
  }

  cachedNotePositions = notes;
  return notes;
}

/**
 * Find the note at the given client (viewport) coordinates using DOM hit-testing.
 * Returns null if no note is found at the position.
 */
export function findOsmdNoteAtPosition(
  clientX: number,
  clientY: number,
): NoteBounds | null {
  if (!noteElementMap) return null;

  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (!(el instanceof SVGElement)) continue;
    const staveNote = el.closest('.vf-stavenote');
    if (staveNote instanceof SVGElement) {
      const note = noteElementMap.get(staveNote);
      if (note) return note;
    }
  }

  return null;
}
