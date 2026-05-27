import { DURATION_TO_BEATS } from '../types/notation';
import type { Measure } from '../types/notation';

/** Convert an OSMD Fraction.RealValue to wall-clock seconds.
 *  RealValue is the fraction of a whole note (e.g. quarter = 0.25),
 *  so we multiply by 4 to get quarter-note beats, then by 60/bpm. */
export function realValueToSeconds(realValue: number, bpm: number): number {
  const seconds = realValue * 4 * (60 / bpm);
  console.log(
    `[TempoConverter] realValueToSeconds: realValue=${realValue}, bpm=${bpm} => ${seconds}s (beats=${realValue * 4})`,
  );
  return seconds;
}

/** Convert a note duration string ("q", "h", etc.) to seconds, with optional dots. */
export function noteDurationToSeconds(
  duration: string,
  tempo: number,
  beatValue: number,
  dots: number = 0,
): number {
  const baseBeats = DURATION_TO_BEATS[duration] ?? 1;
  const dotMultiplier = dots > 0 ? 2 - 1 / Math.pow(2, dots) : 1;
  const beats = baseBeats * dotMultiplier;
  return beats * (60 / tempo) * (4 / beatValue);
}

/** Sum all note durations across every measure to get total playback seconds. */
export function calculateTotalDuration(
  measures: Measure[],
  tempo: number,
  timeSignature: string,
): number {
  const [, beatValue] = timeSignature.split('/').map(Number);
  let total = 0;
  for (const measure of measures) {
    for (const note of measure.notes) {
      total += noteDurationToSeconds(
        note.duration,
        tempo,
        beatValue || 4,
        note.dots,
      );
    }
  }
  return total;
}

/** Convert an absolute beat count to wall-clock seconds. */
export function beatsToSeconds(
  beats: number,
  tempo: number,
  beatValue: number = 4,
): number {
  return beats * (60 / tempo) * (4 / beatValue);
}
