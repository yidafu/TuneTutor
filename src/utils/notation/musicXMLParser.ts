/**
 * MusicXML Parser - Parse .musicxml and .xml files using musicxml-io
 */

import { parse } from 'musicxml-io';
import type { ParsedScore, Measure, Note } from '../../types/notation';

// musicxml-io result types (based on actual library output)
interface MusicXMLIOResult {
  metadata?: {
    movementTitle?: string;
    encoding?: {
      software?: string[];
    };
  };
  partList?: Array<{
    type?: string;
    id?: string;
    name?: string;
  }>;
  parts?: Array<{
    id?: string;
    measures?: MusicXMLMeasure[];
  }>;
}

interface MusicXMLMeasure {
  _id?: string;
  number?: string;
  entries?: MusicXMLEntry[];
  attributes?: {
    divisions?: number;
    time?: {
      beats?: string | number;
      beatType?: string | number;
    };
    key?: {
      fifths?: number;
      mode?: string;
    };
  };
}

type MusicXMLEntry = {
  _id?: string;
  type: string;
  tempo?: number;
  duration?: number;
  voice?: number;
  pitch?: {
    step?: string;
    octave?: number;
    alter?: number;
  };
  noteType?: string;
  dot?: number;
  chord?: boolean;
  grace?: boolean;
  cue?: boolean;
  rest?: boolean;
  notations?: {
    ties?: Array<{ type?: string }>;
  };
};

/**
 * Key signature conversion from fifths to key name
 */
const KEY_NAMES: Record<number, string> = {
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
  '-1': 'F',
  '-2': 'Bb',
  '-3': 'Eb',
  '-4': 'Ab',
  '-5': 'Db',
  '-6': 'Gb',
  '-7': 'Cb',
};

/**
 * Convert MusicXML duration to VexFlow duration string
 * MusicXML duration is based on divisions: duration / divisions = beats (in quarter notes)
 */
function convertDurationToVexFlow(duration: number, divisions: number): string {
  const beats = duration / divisions; // Convert to quarter note units

  // Map beats to VexFlow duration
  if (beats >= 4) return 'w';      // whole note (4+ beats)
  if (beats >= 2) return 'h';      // half note (2 beats)
  if (beats >= 1) return 'q';      // quarter note (1 beat)
  if (beats >= 0.5) return '8';    // eighth note (0.5 beats)
  if (beats >= 0.25) return '16';  // sixteenth note (0.25 beats)

  return 'q'; // default to quarter note
}

/**
 * Convert key signature fifths to key name
 */
function convertKeySignature(fifths: number | undefined): string | undefined {
  if (fifths === undefined) return undefined;
  return KEY_NAMES[fifths] || KEY_NAMES[0];
}

/**
 * Extract tempo from measure entries
 */
function extractTempo(measures: MusicXMLMeasure[]): number {
  for (const measure of measures) {
    if (measure.entries) {
      for (const entry of measure.entries) {
        if (entry.type === 'sound' && entry.tempo) {
          return entry.tempo;
        }
      }
    }
  }
  return 120; // Default tempo
}

/**
 * Parse a single note from MusicXML format
 */
function parseNote(entry: MusicXMLEntry, divisions: number): Note | null {
  // Skip grace notes and cue notes
  if (entry.grace || entry.cue) return null;

  const duration = entry.duration || 1;
  const isRest = !!entry.rest;
  let pitchName = 'C';
  let octave = 4;
  let accidentals: string | undefined;

  if (!isRest && entry.pitch) {
    pitchName = entry.pitch.step || 'C';
    octave = entry.pitch.octave || 4;

    if (entry.pitch.alter === 1) {
      accidentals = '#';
    } else if (entry.pitch.alter === -1) {
      accidentals = 'b';
    }
  }

  const dots = entry.dot || 0;

  return {
    pitch: isRest ? 'rest' : `${pitchName}${octave}`,
    duration: convertDurationToVexFlow(duration, divisions),
    durationValue: duration,
    octave: isRest ? 4 : octave,
    accidentals,
    tiesToNext: false, // Will be set during iteration
    isRest,
    dots,
    voice: entry.voice,
    type: entry.noteType,
  };
}

/**
 * Process ties - mark notes that have ties to next
 */
function processTies(notes: Note[], entries: MusicXMLEntry[]): void {
  let noteIndex = 0;
  for (const entry of entries) {
    if (entry.type !== 'note' || entry.grace || entry.cue) continue;
    if (entry.chord) continue; // Chord notes share duration with previous

    const notations = entry.notations;
    if (notations?.ties?.some(t => t.type === 'start')) {
      if (noteIndex < notes.length) {
        notes[noteIndex].tiesToNext = true;
      }
    }
    noteIndex++;
  }
}

/**
 * Parse measures from a part
 */
function parseMeasures(
  part: NonNullable<MusicXMLIOResult['parts']>[number],
  defaultDivisions: number,
  defaultBeats: number,
  defaultBeatType: number
): Measure[] {
  const measures: Measure[] = [];
  let currentMeasureIndex = 0;

  for (const measure of part.measures || []) {
    // Get measure attributes
    const attrs = measure.attributes;
    const currentDivisions = attrs?.divisions || defaultDivisions;
    const measureBeats = attrs?.time?.beats || defaultBeats;
    const measureBeatType = attrs?.time?.beatType || defaultBeatType;
    const measureKeyFifths = attrs?.key?.fifths;

    // Parse notes from entries
    const notes: Note[] = [];
    const entries = measure.entries || [];

    for (const entry of entries) {
      if (entry.type !== 'note') continue;

      // Skip chord notes (they share duration with previous note)
      if (entry.chord) continue;

      const parsedNote = parseNote(entry, currentDivisions);
      if (parsedNote) {
        notes.push(parsedNote);
      }
    }

    // Process ties
    processTies(notes, entries);

    measures.push({
      index: currentMeasureIndex,
      notes,
      timeSignature: `${measureBeats}/${measureBeatType}`,
      keySignature: measureKeyFifths !== undefined
        ? convertKeySignature(measureKeyFifths)
        : undefined,
    });

    currentMeasureIndex++;
  }

  return measures;
}

/**
 * Convert musicxml-io result to internal ParsedScore format
 */
function convertToParsedScore(result: MusicXMLIOResult): ParsedScore {
  // Get title from metadata
  const title = result.metadata?.movementTitle || 'Untitled';

  // Get parts
  const parts = result.parts || [];

  // Use first part for score
  const firstPart = parts[0];
  if (!firstPart || !firstPart.measures || firstPart.measures.length === 0) {
    return {
      title,
      composer: undefined,
      measures: [],
      tempo: 120,
      timeSignature: '4/4',
      keySignature: undefined,
      divisions: 1,
    };
  }

  // Get default divisions from first measure's attributes
  const defaultDivisions = firstPart.measures[0].attributes?.divisions || 1;

  // Get time signature from first measure
  const firstMeasure = firstPart.measures[0];
  const beats = Number(firstMeasure.attributes?.time?.beats) || 4;
  const beatType = Number(firstMeasure.attributes?.time?.beatType) || 4;

  // Parse all measures
  const measures = parseMeasures(firstPart, defaultDivisions, beats, beatType);

  // Extract tempo
  const tempo = extractTempo(firstPart.measures || []);

  // Get key signature
  const keySignature = firstMeasure.attributes?.key?.fifths !== undefined
    ? convertKeySignature(firstMeasure.attributes.key.fifths)
    : undefined;

  return {
    title,
    composer: undefined,
    measures,
    tempo,
    timeSignature: `${beats}/${beatType}`,
    keySignature,
    divisions: defaultDivisions,
  };
}

/**
 * Parse MusicXML file content to internal score format
 */
export function parseMusicXML(xmlContent: string): ParsedScore {
  try {
    const result = parse(xmlContent) as MusicXMLIOResult;
    const score = convertToParsedScore(result);

    console.log('[MusicXMLParser] Parsed score:', {
      title: score.title,
      composer: score.composer,
      measuresCount: score.measures.length,
      tempo: score.tempo,
      timeSignature: score.timeSignature,
      keySignature: score.keySignature,
      divisions: score.divisions,
      firstMeasureNotes: score.measures[0]?.notes.length || 0,
    });

    return score;
  } catch (error) {
    console.error('[MusicXMLParser] Failed to parse MusicXML:', error);
    throw new Error('Failed to parse MusicXML file');
  }
}

/**
 * Check if a string is valid XML
 */
export function isValidXML(content: string): boolean {
  try {
    const trimmed = content.trim();
    return (
      trimmed.startsWith('<?xml') ||
      trimmed.startsWith('<score-') ||
      trimmed.startsWith('<!DOCTYPE')
    );
  } catch {
    return false;
  }
}

/**
 * Check if file is a MusicXML file
 */
export function isMusicXMLFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.musicxml') ||
    name.endsWith('.xml') ||
    name.endsWith('.mxl')
  );
}
