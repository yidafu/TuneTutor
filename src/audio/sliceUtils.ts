/**
 * Pure, unit-testable helpers for the original-audio slice-loop feature.
 * No wavesurfer/Tone/Web Audio imports — safe to test under jsdom.
 */

/** Format seconds as "m:ss" (floors; clamps negatives to 0). e.g. 65.9 -> "1:05". */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Minimum slice duration (seconds) below which looping is not allowed. */
const MIN_SLICE_SECONDS = 0.05;

export interface AudioLoopPlan {
  /** Slice start, clamped to [0, bufferDuration] (seconds). */
  offset: number;
  /** Play duration, clamped to [offset, bufferDuration] (seconds). */
  duration: number;
  /** One loop cycle: duration + gapSeconds. */
  cycleDuration: number;
  /** Whether the slice is long enough to loop (duration >= MIN_SLICE_SECONDS). */
  loop: boolean;
}

/**
 * Single source of truth for slice clamping + loop validity. Shared by the
 * audio page (UI) and playback so they always agree. Out-of-order start/end
 * are swapped before clamping.
 */
export function buildAudioLoopPlan(
  startTime: number,
  endTime: number,
  gapSeconds: number,
  bufferDuration: number,
): AudioLoopPlan {
  const total = Math.max(0, bufferDuration);
  let start = Math.min(startTime, endTime);
  let end = Math.max(startTime, endTime);
  start = Math.min(Math.max(0, start), total);
  end = Math.min(Math.max(start, end), total);
  const duration = end - start;
  return {
    offset: start,
    duration,
    cycleDuration: duration + Math.max(0, gapSeconds),
    loop: duration >= MIN_SLICE_SECONDS,
  };
}
