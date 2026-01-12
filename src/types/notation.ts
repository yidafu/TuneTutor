/**
 * Music notation types for the Music Notation Player
 */

export interface ParsedScore {
  title: string;
  composer?: string;
  measures: Measure[];
  tempo: number; // BPM
  timeSignature: string; // "4/4", "3/4", etc.
  keySignature?: string;
  divisions: number; // MusicXML divisions value (e.g., 1 = quarter note)
}

export interface Measure {
  index: number;
  notes: Note[];
  timeSignature?: string;
  keySignature?: string;
}

export interface Note {
  pitch: string; // "C4", "G#5", etc. or "rest" for rests
  duration: string; // "q" (quarter), "h" (half), "w" (whole), "8" (eighth), "16" (sixteenth)
  durationValue: number; // Original MusicXML duration value
  octave: number;
  accidentals?: string; // "#", "b", "n"
  tiesToNext?: boolean;
  isRest: boolean; // Whether this is a rest note
  dots: number; // Number of dots (0, 1, 2)
  voice?: number; // Voice number
  type?: string; // Original type element from MusicXML
}

/**
 * Position information for a single note element
 */
export interface NotePosition {
  measureIndex: number;
  noteIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a selected note with its position
 */
export interface SelectedNote {
  measureIndex: number;
  noteIndex: number;
}

/**
 * Selection rectangle for drag selection
 */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Range-based selection with left/right handles
 */
export interface SelectionRange {
  startX: number;
  endX: number;
}

/**
 * VexFlow-specific note duration mapping
 */
export const VEXFLOW_DURATIONS = {
  'w': '1n',   // whole note
  'h': '2n',   // half note
  'q': '4n',   // quarter note
  '8': '8n',   // eighth note
  '16': '16n', // sixteenth note
} as const;

export type VexFlowDuration = keyof typeof VEXFLOW_DURATIONS;
