/**
 * Build a shared playback timeline from the OSMD cursor.
 *
 * Single source of truth for both audio scheduling (PlaybackEngine)
 * and UI progress tracking (usePlayback / App). Eliminates the
 * dual-calculation problem where ParsedScore-based approximations
 * (DURATION_TO_BEATS) drifted from the OSMD RealValue-based timing.
 */

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Frequency } from 'tone';
import { realValueToSeconds } from './TempoConverter';
import type { TimelineEntry } from '../types/playback';

export interface BuildTimelineRange {
  startTime: number;
  endTime: number;
}

/**
 * Walk the OSMD cursor and produce a flat TimelineEntry[].
 *
 * @param osmd  A rendered OpenSheetMusicDisplay instance.
 * @param bpm   Tempo in beats per minute.
 * @param range Optional range to filter entries (in seconds from score start).
 *              When provided, entry times are shifted so the first entry starts at 0.
 */
export function buildTimeline(
  osmd: OpenSheetMusicDisplay,
  bpm: number,
  range?: BuildTimelineRange,
): TimelineEntry[] {
  const cursor = osmd.cursor;
  cursor.reset();

  const filtering = range !== undefined;
  const entries: TimelineEntry[] = [];
  let accumulatedTime = 0;
  let globalNoteIndex = 0;

  while (!cursor.Iterator.EndReached) {
    const measureIdx = cursor.Iterator.CurrentMeasureIndex;
    const voiceEntries = cursor.Iterator.CurrentVoiceEntries;

    if (!voiceEntries || voiceEntries.length === 0) {
      cursor.next();
      continue;
    }

    let maxRealValue = 0;

    for (const ve of voiceEntries) {
      if (ve.IsGrace) continue;

      for (const note of ve.Notes) {
        if (note.IsGraceNote) continue;

        // Skip tie continuation notes — the start note carries the full duration
        if (note.NoteTie && note !== note.NoteTie.StartNote) continue;

        const isTied = !!(note.NoteTie);
        const effectiveRealValue = isTied
          ? note.NoteTie!.Duration.RealValue
          : note.Length.RealValue;

        if (effectiveRealValue > maxRealValue) {
          maxRealValue = effectiveRealValue;
        }

        if (note.isRest()) {
          globalNoteIndex++;
          continue;
        }

        const duration = realValueToSeconds(effectiveRealValue, bpm);
        const noteName = Frequency(note.halfTone, 'midi').toNote();
        const inRange = !filtering || (accumulatedTime >= range!.startTime && accumulatedTime < range!.endTime);

        if (inRange) {
          entries.push({
            time: filtering ? accumulatedTime - range!.startTime : accumulatedTime,
            duration,
            measureIndex: measureIdx,
            noteIndex: globalNoteIndex,
            noteName,
            isRest: false,
          });
        }

        globalNoteIndex++;
      }
    }

    const advance = realValueToSeconds(maxRealValue, bpm);
    accumulatedTime += advance;

    if (filtering && accumulatedTime > range!.endTime) break;

    cursor.next();
  }

  return entries;
}
