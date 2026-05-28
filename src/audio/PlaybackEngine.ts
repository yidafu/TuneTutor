import { Part, Transport, Draw, Frequency, MembraneSynth, Synth, NoiseSynth, start } from 'tone';
import type { Sampler } from 'tone';
import type { OpenSheetMusicDisplay, Note } from 'opensheetmusicdisplay';
import { InstrumentLoader } from './InstrumentLoader';
import { realValueToSeconds, beatsToSeconds } from './TempoConverter';
import type { MetronomeSoundType } from '../types/playback';

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

// ── Loop config ─────────────────────────────────────────

export interface PlaybackLoopConfig {
  enabled: boolean;
  startBeat: number;
  endBeat: number;
  skipBeats: number;
}

// ── Metronome presets ────────────────────────────────────

type MetronomeSynth = MembraneSynth | Synth | NoiseSynth;

interface MetronomePreset {
  strongNote: string;
  weakNote: string;
  createSynth: () => MetronomeSynth;
}

const METRONOME_PRESETS: Record<MetronomeSoundType, MetronomePreset> = {
  classic: {
    strongNote: 'C4',
    weakNote: 'C3',
    createSynth: () => new MembraneSynth({
      pitchDecay: 0.02,
      octaves: 7,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
    }).toDestination(),
  },
  digital: {
    strongNote: 'C5',
    weakNote: 'C4',
    createSynth: () => new Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    }).toDestination(),
  },
  kick: {
    strongNote: 'C2',
    weakNote: 'C1',
    createSynth: () => new MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.01 },
    }).toDestination(),
  },
  click: {
    strongNote: 'C3',
    weakNote: 'C3',
    createSynth: () => new NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    }).toDestination(),
  },
};

// ── Engine ──────────────────────────────────────────────

export class PlaybackEngine {
  private osmd: OpenSheetMusicDisplay | null = null;
  private bpm = 60;
  private sampler: Sampler | null = null;
  private loader = new InstrumentLoader();
  private part: Part | null = null;
  private metronomeSynth: MetronomeSynth | null = null;
  private metronomeEventId: number | null = null;
  private metronomeEnabled = false;
  private metronomeSound: MetronomeSoundType = 'kick';
  private metronomeStrongVolume = 0.8;
  private metronomeWeakVolume = 0.5;
  private beatCounter = 0;
  private beatsPerMeasure = 4;
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

  async play(loopConfig?: PlaybackLoopConfig): Promise<void> {
    await start();
    console.log('[PlaybackEngine] play() called, loopConfig:', loopConfig, 'hasOsmd:', !!this.osmd, 'hasSampler:', !!this.sampler);
    if (!this.osmd || !this.sampler) return;

    this.part?.dispose();
    Transport.cancel();

    if (this.metronomeEnabled) {
      this.metronomeEventId = null;
      this.beatCounter = 0;
      this.ensureMetronomeScheduled();
    }

    Transport.bpm.value = this.bpm;

    if (loopConfig?.enabled) {
      console.log('[PlaybackEngine] Entering LOOP branch');
      const startTime = beatsToSeconds(loopConfig.startBeat, this.bpm, 4);
      const endTime = beatsToSeconds(loopConfig.endBeat, this.bpm, 4);
      console.log('[PlaybackEngine] Loop range in seconds:', { startTime: startTime.toFixed(2), endTime: endTime.toFixed(2), bpm: this.bpm });
      const timeline = this.buildTimetable(startTime, endTime);
      console.log('[PlaybackEngine] Filtered timeline:', { eventCount: timeline.length });
      if (timeline.length === 0) {
        console.warn('[PlaybackEngine] Empty timeline — no notes in loop range, aborting');
        return;
      }

      const playDuration = endTime - startTime;
      const skipDuration = beatsToSeconds(loopConfig.skipBeats, this.bpm, 4);

      this.part = new Part((time, event: ScheduledNoteEvent) => {
        this.sampler!.triggerAttackRelease(event.noteName, event.duration, time, 0.7);
        Draw.schedule(() => {
          this.emit(PlaybackEvent.ITERATION, event.originalNotes);
        }, time);
      }, timeline);

      this.part.loop = true;
      this.part.loopEnd = playDuration + skipDuration;

      console.log(
        `[PlaybackEngine] Loop playback: range [${loopConfig.startBeat}-${loopConfig.endBeat}] beats, ` +
        `play=${playDuration.toFixed(2)}s, skip=${skipDuration.toFixed(2)}s, loopEnd=${(playDuration + skipDuration).toFixed(2)}s, events=${timeline.length}`,
      );
      console.log('[PlaybackEngine] Part.loop:', this.part.loop, 'Part.loopEnd:', this.part.loopEnd);

      this.part.start(0);
      Transport.start();
      console.log('[PlaybackEngine] Transport started in LOOP mode');
      this.emit(PlaybackEvent.STATE_CHANGE, 'PLAYING');
      return;
    }

    // Non-loop playback (original behavior)
    console.log('[PlaybackEngine] Entering NON-LOOP branch');
    const timeline = this.buildTimetable();
    if (timeline.length === 0) return;

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
    this.emit(PlaybackEvent.STATE_CHANGE, 'PLAYING');
  }

  stop(): void {
    Transport.stop();
    Transport.cancel();
    this.part?.dispose();
    this.part = null;
    this.metronomeEventId = null;
    this.beatCounter = 0;
    this.emit(PlaybackEvent.STATE_CHANGE, 'STOPPED');
  }

  setBpm(tempo: number): void {
    this.bpm = tempo;
    Transport.bpm.value = tempo;
  }

  toggleMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
    if (enabled) {
      this.ensureMetronomeScheduled();
    } else {
      this.clearMetronome();
    }
  }

  setBeatsPerMeasure(beats: number): void {
    this.beatsPerMeasure = beats;
  }

  setMetronomeSound(sound: MetronomeSoundType): void {
    if (this.metronomeSound === sound) return;
    this.metronomeSound = sound;
    if (this.metronomeEnabled) {
      this.clearMetronome();
      this.ensureMetronomeScheduled();
    }
  }

  setMetronomeStrongVolume(volume: number): void {
    this.metronomeStrongVolume = volume;
  }

  setMetronomeWeakVolume(volume: number): void {
    this.metronomeWeakVolume = volume;
  }

  // ── Private metronome helpers ─────────────────────────

  private ensureMetronomeScheduled(): void {
    if (this.metronomeSynth) {
      this.metronomeSynth.dispose();
      this.metronomeSynth = null;
    }

    const preset = METRONOME_PRESETS[this.metronomeSound];
    this.metronomeSynth = preset.createSynth();
    this.beatCounter = 0;

    if (this.metronomeEventId === null) {
      this.metronomeEventId = Transport.scheduleRepeat((time) => {
        if (!this.metronomeSynth || !this.metronomeEnabled) return;
        const isStrong = this.beatCounter % this.beatsPerMeasure === 0;
        const noteName = isStrong ? preset.strongNote : preset.weakNote;
        const velocity = isStrong ? this.metronomeStrongVolume : this.metronomeWeakVolume;
        (this.metronomeSynth as any).triggerAttackRelease(noteName, '16n', time, velocity);
        this.beatCounter++;
      }, '4n');
    }
  }

  private clearMetronome(): void {
    if (this.metronomeEventId !== null) {
      Transport.clear(this.metronomeEventId);
      this.metronomeEventId = null;
    }
    if (this.metronomeSynth) {
      this.metronomeSynth.dispose();
      this.metronomeSynth = null;
    }
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

  private buildTimetable(startTime?: number, endTime?: number): ScheduledNoteEvent[] {
    const osmd = this.osmd!;
    const cursor = osmd.cursor;
    cursor.reset();

    const filtering = startTime !== undefined && endTime !== undefined;
    if (filtering) {
      console.log(`[PlaybackEngine] buildTimetable filtering: startTime=${startTime!.toFixed(2)}s, endTime=${endTime!.toFixed(2)}s, bpm=${this.bpm}`);
    }

    const events: ScheduledNoteEvent[] = [];
    let accumulatedTime = 0;
    let entryIndex = 0;
    let skippedCount = 0;
    let totalEntries = 0;

    while (!cursor.Iterator.EndReached) {
      const entries = cursor.Iterator.CurrentVoiceEntries;
      if (!entries || entries.length === 0) {
        cursor.next();
        continue;
      }

      totalEntries++;
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

          const inRange = !filtering || (accumulatedTime >= startTime! && accumulatedTime < endTime!);
          if (inRange) {
            events.push({
              time: filtering ? accumulatedTime - startTime! : accumulatedTime,
              duration,
              noteName,
              originalNotes: isTied ? note.NoteTie!.Notes : [note],
            });
          } else if (filtering) {
            skippedCount++;
          }
        }
      }

      const advance = realValueToSeconds(maxRealValue, this.bpm);
      accumulatedTime += advance;
      entryIndex++;

      if (filtering && accumulatedTime > endTime!) break;

      cursor.next();
    }

    if (filtering) {
      console.log(`[PlaybackEngine] buildTimetable result: ${events.length} events in range, ${skippedCount} notes skipped, ${totalEntries} entries processed, final accumulatedTime=${accumulatedTime.toFixed(2)}s`);
    }

    return events;
  }
}
