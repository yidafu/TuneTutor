/**
 * PhraseMarkers - Visual overlays for phrase start/end positions in the
 * rendered score. Renders as `|>` and `<|` bracket markers at the
 * selection boundaries, plus a highlight connecting the range and a
 * clear button.
 */

import { useMemo } from 'react';
import type { PhraseSelection } from '../types/notation';
import { getOsmdNotePositions } from '../utils/notation/NoteInteraction';
import { getOsmdInstance } from '../utils/notation/OsmdRender';

interface PhraseMarkersProps {
  phraseSelection: PhraseSelection;
  onClearPhrase?: () => void;
  container?: HTMLElement | null;
}

interface NotePos {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StaffBounds {
  top: number;
  height: number;
}

/** Arrow size in pixels */
const ARROW = 9;
/** Bar thickness in pixels */
const BAR = 4;
/** Vertical padding around the note */
const PAD_V = 6;
/** Horizontal gap between bar and note */
const GAP = 4;

/**
 * Find the rendered position of a note by looking up the corresponding
 * `.vf-notehead` SVG element and using its DOM bounding rect relative
 * to the container. This avoids coordinate mismatches with OSMD's
 * internal AbsolutePosition values vs CSS layout.
 */
function findNotePosition(
  measureIndex: number,
  noteIndex: number,
  container: HTMLElement,
): NotePos | null {
  const positions = getOsmdNotePositions();
  const idx = positions.findIndex(
    (p) => p.measureIndex === measureIndex && p.noteIndex === noteIndex,
  );
  if (idx === -1) return null;

  const svg = container.querySelector('svg');
  if (!svg) return null;

  const noteheads = svg.querySelectorAll<SVGElement>('.vf-notehead');
  const notehead = noteheads[idx];
  if (!notehead) return null;

  const containerRect = container.getBoundingClientRect();
  const noteRect = notehead.getBoundingClientRect();

  return {
    x: noteRect.left - containerRect.left,
    y: noteRect.top - containerRect.top,
    width: noteRect.width,
    height: noteRect.height,
  };
}

/**
 * Find the pixel positions of the top and bottom staff lines for the staff
 * containing a note at the given position. Uses OSMD internal data to find
 * the SVG elements for the 5 staff lines, then reads their bounding rects
 * for accurate pixel coordinates.
 */
function findStaffBounds(
  container: HTMLElement,
  noteY: number,
  measureIndex: number,
): StaffBounds | null {
  const osmd = getOsmdInstance();
  if (!osmd) return null;

  try {
    const graphic = osmd as unknown as {
      graphic: { measureList: unknown[][] };
    };
    if (!graphic?.graphic?.measureList) return null;

    const measureList = graphic.graphic.measureList;
    if (measureIndex >= measureList.length) return null;

    const staffMeasures = measureList[measureIndex];
    if (!staffMeasures?.length) return null;

    const checkedStaffLines = new Set<unknown>();
    const containerRect = container.getBoundingClientRect();

    for (const measure of staffMeasures) {
      if (!measure) continue;

      // Navigate: GraphicalMeasure → ParentStaffLine → StaffLines[] → SVGElement
      const m = measure as { ParentStaffLine?: { StaffLines?: { SVGElement?: Node }[] } };
      const staffLine = m.ParentStaffLine;
      if (!staffLine || checkedStaffLines.has(staffLine)) continue;
      checkedStaffLines.add(staffLine);

      const staffLines = staffLine.StaffLines;
      if (!staffLines || staffLines.length < 5) continue;

      const topLineEl = staffLines[0].SVGElement;
      const bottomLineEl = staffLines[4].SVGElement;
      if (!topLineEl || !bottomLineEl) continue;

      const topRect = (topLineEl as Element).getBoundingClientRect();
      const bottomRect = (bottomLineEl as Element).getBoundingClientRect();

      const staffTop = topRect.top - containerRect.top;
      const staffBottom = bottomRect.top - containerRect.top;
      const staffHeight = staffBottom - staffTop;

      // Check if the note is within this staff (with tolerance)
      const tolerance = 20;
      if (noteY >= staffTop - tolerance && noteY <= staffBottom + tolerance) {
        return { top: staffTop, height: staffHeight };
      }
    }

    // Fallback: return bounds from the first found staff
    const firstLine = Array.from(checkedStaffLines)[0] as
      | { StaffLines?: { SVGElement?: Node }[] }
      | undefined;
    if (firstLine?.StaffLines && firstLine.StaffLines.length >= 5) {
      const topEl = firstLine.StaffLines[0].SVGElement;
      const bottomEl = firstLine.StaffLines[4].SVGElement;
      if (topEl && bottomEl) {
        const topRect = (topEl as Element).getBoundingClientRect();
        const bottomRect = (bottomEl as Element).getBoundingClientRect();
        return {
          top: topRect.top - containerRect.top,
          height: bottomRect.top - topRect.top,
        };
      }
    }
  } catch (e) {
    console.warn('[PhraseMarkers] findStaffBounds error:', e);
  }

  return null;
}

/**
 * A `|>` marker placed before the start note.
 * The bar spans the full staff height when staff bounds are available,
 * otherwise falls back to a fixed height around the note.
 */
function StartBracket({ x, noteY, staffTop, staffHeight }: { x: number; noteY: number; staffTop?: number; staffHeight?: number }) {
  const top = staffTop ?? (noteY - PAD_V);
  const height = staffHeight ?? 60;
  const arrowLeft = x - GAP;                          // arrow tip at GAP from note
  const barLeft = arrowLeft - ARROW - BAR;              // bar left of the arrow

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 8 }}>
      {/* Vertical bar (leftmost) */}
      <div
        style={{
          position: 'absolute',
          left: barLeft,
          top,
          width: BAR,
          height,
          backgroundColor: '#f97316',
          borderRadius: 2,
        }}
      />
      {/* Arrow pointing right (border-left triangle → points right) */}
      <div
        style={{
          position: 'absolute',
          left: arrowLeft,
          top: top + (height - ARROW) / 2,
          width: 0,
          height: 0,
          borderTop: `${ARROW / 2}px solid transparent`,
          borderBottom: `${ARROW / 2}px solid transparent`,
          borderLeft: `${ARROW}px solid #f97316`,
        }}
      />
      {/* Label */}
      <span
        style={{
          position: 'absolute',
          left: barLeft - 2,
          top: top - 16,
          fontSize: 10,
          fontWeight: 700,
          color: '#f97316',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        START
      </span>
    </div>
  );
}

/**
 * A `<|` marker placed after the end note.
 * The bar spans the full staff height when staff bounds are available,
 * otherwise falls back to a fixed height around the note.
 */
function EndBracket({ x, noteY, staffTop, staffHeight }: { x: number; noteY: number; staffTop?: number; staffHeight?: number }) {
  const top = staffTop ?? (noteY - PAD_V);
  const height = staffHeight ?? 60;
  const arrowLeft = x + GAP;                          // arrow tip at GAP from note
  const barLeft = arrowLeft + ARROW;                   // bar right of the arrow

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 8 }}>
      {/* Arrow pointing left (border-right triangle → points left) */}
      <div
        style={{
          position: 'absolute',
          left: arrowLeft,
          top: top + (height - ARROW) / 2,
          width: 0,
          height: 0,
          borderTop: `${ARROW / 2}px solid transparent`,
          borderBottom: `${ARROW / 2}px solid transparent`,
          borderRight: `${ARROW}px solid #ef4444`,
        }}
      />
      {/* Vertical bar (rightmost) */}
      <div
        style={{
          position: 'absolute',
          left: barLeft,
          top,
          width: BAR,
          height,
          backgroundColor: '#ef4444',
          borderRadius: 2,
        }}
      />
      {/* Label */}
      <span
        style={{
          position: 'absolute',
          left: arrowLeft - 4,
          top: top - 16,
          fontSize: 10,
          fontWeight: 700,
          color: '#ef4444',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        END
      </span>
    </div>
  );
}

/**
 * A subtle highlight stripe spanning the selected region.
 */
function RangeHighlight({
  startX,
  endX,
  y,
}: {
  startX: number;
  endX: number;
  y: number;
}) {
  const left = startX;
  const width = endX - startX;
  if (width <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: y - PAD_V + 2,
        width,
        height: 60,
        backgroundColor: 'rgba(249, 115, 22, 0.08)',
        pointerEvents: 'none',
        zIndex: 7,
        borderTop: '1.5px dashed rgba(249, 115, 22, 0.35)',
        borderBottom: '1.5px dashed rgba(249, 115, 22, 0.35)',
      }}
    />
  );
}

export function PhraseMarkers({ phraseSelection, onClearPhrase, container }: PhraseMarkersProps) {
  const startPos = useMemo(
    () => {
      if (!container) return null;
      return findNotePosition(
        phraseSelection.startNote.measureIndex,
        phraseSelection.startNote.noteIndex,
        container,
      );
    },
    [phraseSelection.startNote.measureIndex, phraseSelection.startNote.noteIndex, container],
  );

  const endPos = useMemo(
    () => {
      if (!phraseSelection.endNote || !container) return null;
      return findNotePosition(
        phraseSelection.endNote.measureIndex,
        phraseSelection.endNote.noteIndex,
        container,
      );
    },
    [phraseSelection.endNote?.measureIndex, phraseSelection.endNote?.noteIndex, container],
  );

  const startStaffBounds = useMemo(
    () => {
      if (!container || !startPos) return null;
      return findStaffBounds(
        container,
        startPos.y,
        phraseSelection.startNote.measureIndex,
      );
    },
    [container, startPos, phraseSelection.startNote.measureIndex],
  );

  const endStaffBounds = useMemo(
    () => {
      if (!container || !endPos) return null;
      return findStaffBounds(
        container,
        endPos.y,
        phraseSelection.endNote!.measureIndex,
      );
    },
    [container, endPos, phraseSelection.endNote?.measureIndex],
  );

  return (
    <>
      {startPos && (
        <StartBracket
          x={startPos.x}
          noteY={startPos.y}
          staffTop={startStaffBounds?.top}
          staffHeight={startStaffBounds?.height}
        />
      )}
      {endPos && (
        <EndBracket
          x={endPos.x + endPos.width}
          noteY={endPos.y}
          staffTop={endStaffBounds?.top}
          staffHeight={endStaffBounds?.height}
        />
      )}
      {startPos && endPos && (
        <RangeHighlight
          startX={startPos.x}
          endX={endPos.x + endPos.width}
          y={startPos.y}
        />
      )}
      {endPos && (
        <button
          onClick={onClearPhrase ?? (() => {})}
          style={{
            position: 'absolute',
            left: endPos.x + endPos.width + 28,
            top: endPos.y - 8,
            zIndex: 20,
          }}
          className="flex items-center justify-center w-5 h-5 text-xs text-white bg-red-500 rounded-full hover:bg-red-600"
          aria-label="Clear phrase selection"
        >
          ×
        </button>
      )}
    </>
  );
}
