/**
 * Note interaction utilities for OSMD
 */

import { getOsmdInstance } from './OsmdRender';

export interface NotePosition {
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

let cachedNotePositions: NotePosition[] | null = null;
let noteElementMap: Map<SVGElement, NotePosition> | null = null;

/**
 * Invalidate all caches. Call when OSMD clears or re-renders.
 */
export function invalidateNoteCaches(): void {
  cachedNotePositions = null;
  noteElementMap = null;
}

/**
 * Build a Map from SVG .vf-notehead elements to NotePosition.
 * Must be called after OSMD renders (SVG elements are in the DOM).
 */
export function buildNoteElementMap(container: HTMLElement): void {
  const svg = container.querySelector('svg');
  if (!svg) {
    console.warn('[NoteInteraction] No SVG found in container');
    return;
  }

  const positions = getOsmdNotePositions();
  const noteheads = svg.querySelectorAll<SVGElement>('.vf-notehead');

  console.log('[NoteInteraction] buildNoteElementMap:', {
    svgExists: true,
    positionsCount: positions.length,
    noteheadsCount: noteheads.length,
  });

  // Log first few notehead classes for debugging
  if (noteheads.length > 0) {
    const sampleClasses: string[] = [];
    for (let i = 0; i < Math.min(3, noteheads.length); i++) {
      sampleClasses.push(noteheads[i].className?.baseVal || noteheads[i].className || 'no-class');
    }
    console.log('[NoteInteraction] sample notehead classes:', sampleClasses);
  }

  noteElementMap = new Map();
  const count = Math.min(noteheads.length, positions.length);
  for (let i = 0; i < count; i++) {
    noteElementMap.set(noteheads[i], positions[i]);
  }
  console.log('[NoteInteraction] noteElementMap built, size:', noteElementMap.size);
}

/**
 * Get all note positions from the rendered score.
 * Result is cached until invalidateNoteCaches() is called.
 */
export function getOsmdNotePositions(): NotePosition[] {
  if (cachedNotePositions) {
    console.log('[NoteInteraction] getOsmdNotePositions: using cache, count:', cachedNotePositions.length);
    return cachedNotePositions;
  }

  const osmd = getOsmdInstance();
  if (!osmd) {
    console.warn('[NoteInteraction] getOsmdNotePositions: No OSMD instance');
    return [];
  }

  const notes: NotePosition[] = [];

  try {
    const graphic = osmd as unknown as {
      graphic: { measureList: GraphicMeasureObj[][] };
    };
    if (!graphic?.graphic?.measureList) {
      return [];
    }

    const measureList = graphic.graphic.measureList;
    if (!Array.isArray(measureList)) {
      console.warn('[NoteInteraction] measureList is not an array');
      return [];
    }

    console.log('[NoteInteraction] measureList length:', measureList.length);

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
              if (box) {
                notes.push({
                  measureIndex: m,
                  noteIndex: globalNoteIndex,
                  x: box.AbsolutePosition.x,
                  y: box.AbsolutePosition.y,
                  width: box.Width,
                  height: box.Height,
                });
              }
              globalNoteIndex++; // Always increment to match timeline indices
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[NoteInteraction] Error getting note positions:', error);
  }

  console.log('[NoteInteraction] getOsmdNotePositions: collected', notes.length, 'positions');
  cachedNotePositions = notes;
  return notes;
}

/**
 * Get the SVG .vf-notehead elements within the phrase selection range.
 *
 * Uses the cached note positions (from getOsmdNotePositions) to find the
 * start/end indices, then matches them by index to .vf-notehead elements
 * in the rendered SVG. The two arrays correspond 1:1 (same ordering as
 * buildNoteElementMap creates).
 *
 * @param container  The .osmd-container element containing the rendered SVG.
 * @param startNote  The start note of the phrase selection.
 * @param endNote    The end note of the phrase selection.
 * @returns Array of SVG .vf-notehead elements within the range (inclusive).
 */
export function getNoteElementsInRange(
  container: HTMLElement,
  startNote: { measureIndex: number; noteIndex: number },
  endNote: { measureIndex: number; noteIndex: number },
): SVGElement[] {
  const positions = getOsmdNotePositions();
  const startIdx = positions.findIndex(
    p => p.measureIndex === startNote.measureIndex && p.noteIndex === startNote.noteIndex,
  );
  const endIdx = positions.findIndex(
    p => p.measureIndex === endNote.measureIndex && p.noteIndex === endNote.noteIndex,
  );
  if (startIdx === -1 || endIdx === -1) return [];

  const min = Math.min(startIdx, endIdx);
  const max = Math.max(startIdx, endIdx);
  const svg = container.querySelector('svg');
  if (!svg) return [];

  const noteheads = Array.from(svg.querySelectorAll<SVGElement>('.vf-notehead'));
  return noteheads.slice(min, max + 1);
}

/**
 * Find the note at a click position using DOM hit-testing.
 *
 * Strategy (in order of reliability):
 * 1. Use the event's actual target element (the DOM node the user clicked on) —
 *    no coordinate calculation needed, always the exact clicked element.
 * 2. Fallback to elementsFromPoint for programmatic clicks or edge cases.
 *
 * The noteElementMap (built by buildNoteElementMap() after render)
 * maps SVG .vf-notehead elements to their NotePosition data.
 *
 * @param clientX Viewport x coordinate (only used for elementsFromPoint fallback)
 * @param clientY Viewport y coordinate (only used for elementsFromPoint fallback)
 * @param target The click event's target element (event.target), the most reliable source.
 */
export function findOsmdNoteAtPosition(
  clientX: number,
  clientY: number,
  target?: EventTarget | null,
): NotePosition | null {
  if (!noteElementMap) {
    console.log('[NoteInteraction] findOsmdNoteAtPosition: noteElementMap is null');
    return null;
  }

  // Strategy 1: use the actual clicked DOM element — most reliable, no coordinate issues
  if (target instanceof Element) {
    const targetTag = target.tagName;
    const targetClass = target instanceof SVGElement ? target.className.baseVal : (target as Element).className || '';
    const notehead = target.closest('.vf-notehead') as SVGElement | null;
    console.log('[NoteInteraction] Strategy 1:', {
      targetTag,
      targetClass: typeof targetClass === 'string' ? targetClass.slice(0, 100) : 'no class',
      foundNotehead: !!notehead,
      noteheadTag: notehead?.tagName,
      noteheadClass: notehead?.className?.baseVal,
      mapSize: noteElementMap.size,
      hasNoteInMap: notehead ? noteElementMap.has(notehead) : false,
    });
    if (notehead) {
      const note = noteElementMap.get(notehead);
      if (note) {
        console.log('[NoteInteraction] ✅ Found note via event.target:', note);
        return note;
      }
    }
  }

  // Strategy 2: fallback to elementsFromPoint for programmatic clicks
  const elements = document.elementsFromPoint(clientX, clientY);
  console.log('[NoteInteraction] Strategy 2: elementsFromPoint count:', elements.length,
    'first tag:', elements[0]?.tagName, 'first class:', (elements[0] as Element)?.className);
  for (const el of elements) {
    if (!(el instanceof SVGElement)) continue;
    const notehead = el.closest('.vf-notehead') as SVGElement | null;
    if (notehead) {
      const note = noteElementMap.get(notehead);
      if (note) {
        console.log('[NoteInteraction] ✅ Found note via elementsFromPoint:', note);
        return note;
      }
    }
  }

  console.log('[NoteInteraction] ❌ No note found', { mapSize: noteElementMap.size });
  return null;
}
