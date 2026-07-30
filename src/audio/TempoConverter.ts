/** Convert an OSMD Fraction.RealValue to wall-clock seconds.
 *  RealValue is the fraction of a whole note (e.g. quarter = 0.25),
 *  so we multiply by 4 to get quarter-note beats, then by 60/bpm. */
export function realValueToSeconds(realValue: number, bpm: number): number {
  return realValue * 4 * (60 / bpm);
}

/** Convert an absolute beat count to wall-clock seconds. */
export function beatsToSeconds(
  beats: number,
  tempo: number,
  beatValue: number = 4,
): number {
  return beats * (60 / tempo) * (4 / beatValue);
}
