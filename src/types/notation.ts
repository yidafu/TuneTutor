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
  isChord?: boolean; // Whether this is a chord note (shares position with previous note)
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
 * Range-based selection with left/right handles
 */
export interface SelectionRange {
  startX: number;
  endX: number;
  startY?: number;  // Optional Y coordinate for row-aware selection
  endY?: number;
  startNote?: { measureIndex: number; noteIndex: number };  // Starting note for row-aware selection
  endNote?: { measureIndex: number; noteIndex: number };    // Ending note for row-aware selection
}

/**
 * VexFlow duration to beats (quarter note = 1 beat)
 */
export const DURATION_TO_BEATS: Readonly<Record<string, number>> = {
  'w': 4,   // whole note = 4 beats
  'h': 2,   // half note = 2 beats
  'q': 1,   // quarter note = 1 beat
  '8': 0.5, // eighth note = 0.5 beats
  '16': 0.25, // sixteenth note = 0.25 beats
  '32': 0.125,
  '64': 0.0625,
} as const;

/**
 * Create a demo score (Twinkle Twinkle Little Star) as MusicXML
 */
export function createDemoScore(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <identification>
    <encoding>
      <software>Note Slice</software>
    </encoding>
  </identification>
  <work>
    <work-title>Twinkle Twinkle Little Star</work-title>
  </work>
  <creator type="composer">Traditional</creator>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
          <mode>major</mode>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;
}
