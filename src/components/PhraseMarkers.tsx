/**
 * PhraseMarkers - Start/End markers overlaid on OSMD for phrase selection
 */

import type { PhraseSelection } from '../types/notation';
import { getOsmdNotePositions } from '../utils/notation/NoteInteraction';

interface PhraseMarkersProps {
  phraseSelection: PhraseSelection | null;
  onClear: () => void;
}

function findNotePosition(
  measureIndex: number,
  noteIndex: number,
): { x: number; y: number; width: number; height: number } | null {
  const positions = getOsmdNotePositions();
  const found = positions.find(
    (p) => p.measureIndex === measureIndex && p.noteIndex === noteIndex,
  );
  return found ?? null;
}

export function PhraseMarkers({ phraseSelection, onClear }: PhraseMarkersProps) {
  if (!phraseSelection) return null;

  const startPos = findNotePosition(
    phraseSelection.startNote.measureIndex,
    phraseSelection.startNote.noteIndex,
  );
  const endPos = findNotePosition(
    phraseSelection.endNote.measureIndex,
    phraseSelection.endNote.noteIndex,
  );

  return (
    <>
      {/* Start marker */}
      {startPos && (
        <div
          style={{
            position: 'absolute',
            left: startPos.x - 4,
            top: startPos.y - 4,
            width: 3,
            height: startPos.height + 8,
            backgroundColor: '#f97316',
            borderRadius: 1.5,
            pointerEvents: 'none',
            zIndex: 8,
          }}
          title="Phrase start"
        />
      )}

      {/* End marker */}
      {endPos && (
        <div
          style={{
            position: 'absolute',
            left: endPos.x + endPos.width + 1,
            top: endPos.y - 4,
            width: 3,
            height: endPos.height + 8,
            backgroundColor: '#ef4444',
            borderRadius: 1.5,
            pointerEvents: 'none',
            zIndex: 8,
          }}
          title="Phrase end"
        />
      )}

      {/* Clear button near end marker */}
      {endPos && (
        <button
          onClick={onClear}
          style={{
            position: 'absolute',
            left: endPos.x + endPos.width + 8,
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

export default PhraseMarkers;
