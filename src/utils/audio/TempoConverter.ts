/**
 * Tempo Converter - Convert between tempo, beats, and time
 */

/**
 * Calculate the duration of a note in seconds based on tempo
 */
export function noteDurationToSeconds(
  duration: string,
  tempo: number,
  timeSignatureBeatValue: number = 4
): number {
  // Convert VexFlow duration to beats
  const durationToQuarterBeats: Record<string, number> = {
    'w': 4,   // whole note = 4 quarter beats
    'h': 2,   // half note = 2 quarter beats
    'q': 1,   // quarter note = 1 quarter beat
    '8': 0.5, // eighth note = 0.5 quarter beats
    '16': 0.25, // sixteenth note = 0.25 quarter beats
    '32': 0.125,
    '64': 0.0625,
  };

  const quarterBeats = durationToQuarterBeats[duration] || 1;

  // Convert quarter beats to actual duration based on time signature
  const beatDuration = 60 / tempo; // seconds per quarter note
  const quarterNoteDuration = beatDuration * (4 / timeSignatureBeatValue);

  return quarterBeats * quarterNoteDuration;
}

/**
 * Calculate the duration of a measure in seconds
 */
export function measureDurationToSeconds(
  beats: number,
  tempo: number,
  timeSignatureBeatValue: number = 4
): number {
  const beatDuration = 60 / tempo;
  const quarterNoteDuration = beatDuration * (4 / timeSignatureBeatValue);

  return beats * quarterNoteDuration;
}

/**
 * Convert BPM to seconds per beat
 */
export function bpmToSecondsPerBeat(tempo: number): number {
  return 60 / tempo;
}

/**
 * Convert seconds per beat to BPM
 */
export function secondsPerBeatToBpm(secondsPerBeat: number): number {
  return 60 / secondsPerBeat;
}

/**
 * Calculate the total duration of a sequence of measures
 */
export function calculateTotalDuration(
  measures: { notes: { duration: string }[] }[],
  tempo: number,
  timeSignature: string = '4/4'
): number {
  const [, beatValue] = timeSignature.split('/').map(Number);

  let totalSeconds = 0;

  for (const measure of measures) {
    for (const note of measure.notes) {
      totalSeconds += noteDurationToSeconds(note.duration, tempo, beatValue);
    }
  }

  return totalSeconds;
}

/**
 * Format duration in seconds to a human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Calculate the start time for a specific measure in a sequence
 */
export function calculateMeasureStartTime(
  measureIndex: number,
  measures: { notes: { duration: string }[] }[],
  tempo: number,
  timeSignature: string = '4/4',
  measureInterval: number = 0 // Additional beats between measures
): number {
  const [, beatValue] = timeSignature.split('/').map(Number);
  const beatDuration = 60 / tempo;
  const quarterNoteDuration = beatDuration * (4 / beatValue);

  let totalSeconds = 0;

  for (let i = 0; i < measureIndex; i++) {
    const measure = measures[i];
    for (const note of measure.notes) {
      totalSeconds += noteDurationToSeconds(note.duration, tempo, beatValue);
    }
    // Add measure interval
    if (measureInterval > 0) {
      totalSeconds += measureInterval * quarterNoteDuration;
    }
  }

  return totalSeconds;
}

/**
 * Get note value in quarter beats
 */
export function getNoteQuarterBeats(duration: string): number {
  const durationToQuarterBeats: Record<string, number> = {
    'w': 4,
    'h': 2,
    'q': 1,
    '8': 0.5,
    '16': 0.25,
    '32': 0.125,
    '64': 0.0625,
  };

  return durationToQuarterBeats[duration] || 1;
}

export default {
  noteDurationToSeconds,
  measureDurationToSeconds,
  bpmToSecondsPerBeat,
  secondsPerBeatToBpm,
  calculateTotalDuration,
  formatDuration,
  calculateMeasureStartTime,
  getNoteQuarterBeats,
};
