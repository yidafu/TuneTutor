import { Part, Transport, Draw, Frequency, start } from 'tone';
import type { Sampler } from 'tone';
import type { OpenSheetMusicDisplay, Note } from 'opensheetmusicdisplay';
import { InstrumentLoader } from './InstrumentLoader';
import { realValueToSeconds } from './TempoConverter';

// ── Events ──────────────────────────────────────────────

export const PlaybackEvent = {
  ITERATION: 'iteration',
  STATE_CHANGE: 'state-change',
} as const;
export type PlaybackEvent = (typeof PlaybackEvent)[keyof typeof PlaybackEvent];

// ── Internal types ──────────────────────────────────────

interface ScheduledNoteEvent {
  time: number;
  duration: number;
  noteName: string;
  originalNotes: Note[];
}

// ── Engine ──────────────────────────────────────────────

export class PlaybackEngine {
  private osmd: OpenSheetMusicDisplay | null = null;
  private bpm = 60;
  private sampler: Sampler | null = null;
  private loader = new InstrumentLoader();
  private part: Part | null = null;
  private listeners = new Map<PlaybackEvent, Set<(...args: any[]) => void>>();

  constructor() {
    this.loader.loadInstrument('piano').then((s) => {
      this.sampler = s;
    });
  }

  // ── Public API ──────────────────────────────────────

  loadScore(osmd: OpenSheetMusicDisplay): void {
    this.osmd = osmd;
  }

  async play(): Promise<void> {
    await start();
    if (!this.osmd || !this.sampler) return;

    this.part?.dispose();
    Transport.cancel();

    console.log(
      `[PlaybackEngine] play() called, BPM=${this.bpm}, Transport.bpm was ${Transport.bpm.value}`,
    );
    Transport.bpm.value = this.bpm;
    const timeline = this.buildTimetable();
    if (timeline.length === 0) return;

    console.table(
      timeline.slice(0, 10).map((e, i) => ({
        index: i,
        time: e.time.toFixed(3),
        duration: e.duration.toFixed(3),
        noteName: e.noteName,
      })),
    );
    if (timeline.length > 10) {
      console.log(`[PlaybackEngine] ... and ${timeline.length - 10} more events`);
    }

    this.part = new Part((time, event: ScheduledNoteEvent) => {
      this.sampler!.triggerAttackRelease(event.noteName, event.duration, time, 0.7);
      Draw.schedule(() => {
        this.emit(PlaybackEvent.ITERATION, event.originalNotes);
      }, time);
    }, timeline);

    const totalDuration =
      timeline[timeline.length - 1].time + timeline[timeline.length - 1].duration;

    Transport.schedule(() => {
      Transport.stop();
      this.emit(PlaybackEvent.STATE_CHANGE, 'STOPPED');
    }, totalDuration);

    console.log(`[PlaybackEngine] Total duration: ${totalDuration.toFixed(2)}s, events: ${timeline.length}`);
    this.part.start(0);
    Transport.start();
    console.log(`[PlaybackEngine] Transport started, Transport.bpm=${Transport.bpm.value}`);
    this.emit(PlaybackEvent.STATE_CHANGE, 'PLAYING');
  }

  stop(): void {
    Transport.stop();
    Transport.cancel();
    this.part?.dispose();
    this.part = null;
    this.emit(PlaybackEvent.STATE_CHANGE, 'STOPPED');
  }

  setBpm(tempo: number): void {
    this.bpm = tempo;
  }

  on(event: PlaybackEvent, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  // ── Private helpers ─────────────────────────────────

  private emit(event: PlaybackEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  private buildTimetable(): ScheduledNoteEvent[] {
    const osmd = this.osmd!;
    const cursor = osmd.cursor;
    cursor.reset();

    console.log(`[PlaybackEngine] buildTimetable: BPM=${this.bpm}`);

    const events: ScheduledNoteEvent[] = [];
    let accumulatedTime = 0;
    let entryIndex = 0;

    while (!cursor.Iterator.EndReached) {
      const entries = cursor.Iterator.CurrentVoiceEntries;
      if (!entries || entries.length === 0) {
        cursor.next();
        continue;
      }

      let maxRealValue = 0;
      const entryNotes: string[] = [];

      for (const entry of entries) {
        if (entry.IsGrace) continue;

        for (const note of entry.Notes) {
          if (note.IsGraceNote) continue;

          // Skip tie continuation notes — handled as part of the start note
          if (note.NoteTie && note !== note.NoteTie.StartNote) continue;

          const isTied = !!(note.NoteTie);
          const effectiveRealValue = isTied
            ? note.NoteTie!.Duration.RealValue
            : note.Length.RealValue;

          if (effectiveRealValue > maxRealValue) maxRealValue = effectiveRealValue;

          if (note.isRest()) {
            entryNotes.push(`rest(RV=${effectiveRealValue})`);
            continue;
          }

          const duration = realValueToSeconds(effectiveRealValue, this.bpm);
          const noteName = Frequency(note.halfTone, 'midi').toNote();

          entryNotes.push(
            `${noteName}(RV=${effectiveRealValue}, tied=${isTied}, dur=${duration.toFixed(3)}s)`,
          );

          events.push({
            time: accumulatedTime,
            duration,
            noteName,
            originalNotes: isTied ? note.NoteTie!.Notes : [note],
          });
        }
      }

      const advance = realValueToSeconds(maxRealValue, this.bpm);
      console.log(
        `[PlaybackEngine]   entry#${entryIndex} at ${accumulatedTime.toFixed(3)}s: maxRV=${maxRealValue}, advance=${advance.toFixed(3)}s, notes=[${entryNotes.join(', ')}]`,
      );
      accumulatedTime += advance;
      entryIndex++;
      cursor.next();
    }

    console.log(
      `[PlaybackEngine] buildTimetable done: ${events.length} events, totalTime=${accumulatedTime.toFixed(2)}s`,
    );
    return events;
  }
}
