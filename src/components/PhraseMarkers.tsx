/**
 * PhraseMarkers - Visual overlays for phrase start/end positions in the
 * rendered score. Renders as `|>` and `<|` bracket markers at the
 * selection boundaries, plus a highlight connecting the range and a
 * clear button.
 */

import { useMemo } from 'react';
import type { PhraseSelection } from '../types/notation';
import { getOsmdNotePositions } from '../utils/notation/NoteInteraction';

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
 * A `|>` marker placed before the start note.
 * The bar is on the left, arrow points right into the selection.
 */
function StartBracket({ x, y, h }: { x: number; y: number; h: number }) {
  const top = y - PAD_V;
  const height = h + PAD_V * 2;
  const barLeft = x - GAP - BAR;
  const arrowLeft = barLeft - ARROW;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 8 }}>
      {/* Vertical bar */}
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
      {/* Arrow pointing right (border triangle) */}
      <div
        style={{
          position: 'absolute',
          left: arrowLeft,
          top: top + (height - ARROW) / 2,
          width: 0,
          height: 0,
          borderTop: `${ARROW / 2}px solid transparent`,
          borderBottom: `${ARROW / 2}px solid transparent`,
          borderRight: `${ARROW}px solid #f97316`,
        }}
      />
      {/* Label */}
      <span
        style={{
          position: 'absolute',
          left: arrowLeft - 2,
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
 * The arrow points left into the selection, bar is on the right.
 */
function EndBracket({ x, y, h }: { x: number; y: number; h: number }) {
  const top = y - PAD_V;
  const height = h + PAD_V * 2;
  const barLeft = x + GAP;
  const arrowLeft = barLeft + BAR;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 8 }}>
      {/* Vertical bar */}
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
      {/* Arrow pointing left (border triangle) */}
      <div
        style={{
          position: 'absolute',
          left: arrowLeft,
          top: top + (height - ARROW) / 2,
          width: 0,
          height: 0,
          borderTop: `${ARROW / 2}px solid transparent`,
          borderBottom: `${ARROW / 2}px solid transparent`,
          borderLeft: `${ARROW}px solid #ef4444`,
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
  h,
}: {
  startX: number;
  endX: number;
  y: number;
  h: number;
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
        height: h + PAD_V * 2 - 4,
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

  return (
    <>
      {startPos && (
        <StartBracket x={startPos.x} y={startPos.y} h={startPos.height} />
      )}
      {endPos && (
        <EndBracket x={endPos.x + endPos.width} y={endPos.y} h={endPos.height} />
      )}
      {startPos && endPos && (
        <RangeHighlight
          startX={startPos.x}
          endX={endPos.x + endPos.width}
          y={startPos.y}
          h={startPos.height}
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
          className="text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
          aria-label="Clear phrase selection"
        >
          ×
        </button>
      )}
    </>
  );
}
