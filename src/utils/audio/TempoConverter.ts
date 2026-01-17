/**
 * Tempo Converter - Convert between tempo, beats, and time
 */

import { DURATION_TO_BEATS } from "../../types/notation";

/**
 * Calculate the duration of a note in seconds based on tempo
 */
export function noteDurationToSeconds(
  duration: string,
  tempo: number,
  timeSignatureBeatValue: number = 4
): number {
  const beats = DURATION_TO_BEATS[duration] ?? 1;

  // Convert quarter beats to actual duration based on time signature
  const beatDuration = 60 / tempo; // seconds per quarter note
  const quarterNoteDuration = beatDuration * (4 / timeSignatureBeatValue);

  return beats * quarterNoteDuration;
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
 * Calculate the duration of N beats in seconds
 */
export function beatsToSeconds(
  beats: number,
  tempo: number,
  timeSignatureBeatValue: number = 4
): number {
  const beatDuration = 60 / tempo; // seconds per quarter note
  const quarterNoteDuration = beatDuration * (4 / timeSignatureBeatValue);
  return beats * quarterNoteDuration;
}
