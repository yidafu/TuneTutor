import { Part, Transport, Draw, MembraneSynth, Synth, NoiseSynth, start } from 'tone';
import type { Sampler } from 'tone';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { InstrumentLoader } from './InstrumentLoader';
import { buildTimeline } from './buildTimeline';
import type { MetronomeSoundType, LoopRange, TimelineEntry } from '../types/playback';

// ── Events ──────────────────────────────────────────────

export const PlaybackEvent = {
  ITERATION: 'iteration',
  STATE_CHANGE: 'state-change',
} as const;
export type PlaybackEvent = (typeof PlaybackEvent)[keyof typeof PlaybackEvent];

export type PlaybackStateType = 'PLAYING' | 'STOPPED';

// Per-event callback signatures — this type-safely maps each event name to its
// callback parameter list, so on() and emit() catch signature mismatches.
interface PlaybackEventCallback {
  [PlaybackEvent.ITERATION]: (entry: TimelineEntry) => void;
  [PlaybackEvent.STATE_CHANGE]: (state: PlaybackStateType) => void;
}

// ── Loop config ─────────────────────────────────────────

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
  // The Set stores callbacks as Function to work around Map<Event, Set<Fn>>
  // not composing cleanly with the mapped-type approach.  Public on()/emit()
  // methods provide type safety at the call site.
  private listeners = new Map<PlaybackEvent, Set<(...args: unknown[]) => void>>();

  constructor() {
    this.loader.loadInstrument('piano').then((s) => {
      this.sampler = s;
    });
  }

  // ── Public API ──────────────────────────────────────

  loadScore(osmd: OpenSheetMusicDisplay): void {
    this.osmd = osmd;
  }

  async play(loopRange?: LoopRange): Promise<void> {
    await start();
    if (!this.osmd || !this.sampler) return;
    const sampler = this.sampler;

    this.part?.dispose();
    Transport.cancel();

    if (this.metronomeEnabled) {
      this.metronomeEventId = null;
      this.beatCounter = 0;
      this.ensureMetronomeScheduled();
    }

    Transport.bpm.value = this.bpm;

    const timeline = loopRange
      ? buildTimeline(this.osmd, this.bpm, { startTime: loopRange.startTime, endTime: loopRange.endTime })
      : buildTimeline(this.osmd, this.bpm);

    if (timeline.length === 0) {
      console.warn('[PlaybackEngine] Empty timeline — no notes in range, aborting');
      return;
    }

    this.part = new Part((time, event: TimelineEntry) => {
      sampler.triggerAttackRelease(event.noteName, event.duration, time, 0.7);
      Draw.schedule(() => {
        this.emit(PlaybackEvent.ITERATION, event);
      }, time);
    }, timeline);

    if (loopRange) {
      const playDuration = loopRange.endTime - loopRange.startTime;
      this.part.loop = true;
      this.part.loopEnd = playDuration + loopRange.skipTime;
      this.part.start(0);
    } else {
      const totalDuration = timeline[timeline.length - 1].time + timeline[timeline.length - 1].duration;

      Transport.schedule(() => {
        Transport.stop();
        this.emit(PlaybackEvent.STATE_CHANGE, 'STOPPED');
      }, totalDuration);

      this.part.start(0);
    }

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
        const velocity = isStrong ? this.metronomeStrongVolume : this.metronomeWeakVolume;

        if (this.metronomeSynth instanceof NoiseSynth) {
          this.metronomeSynth.triggerAttackRelease('16n', time, velocity);
        } else {
          const noteName = isStrong ? preset.strongNote : preset.weakNote;
          (this.metronomeSynth as MembraneSynth | Synth).triggerAttackRelease(
            noteName,
            '16n',
            time,
            velocity,
          );
        }
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

  on<E extends PlaybackEvent>(event: E, callback: PlaybackEventCallback[E]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    // The stored Set is typed with unknown[], but we only push callbacks that
    // conform to the typed map — the cast is safe.
    (this.listeners.get(event) as Set<PlaybackEventCallback[E]>).add(callback);
  }

  // ── Private helpers ─────────────────────────────────

  private emit<E extends PlaybackEvent>(event: E, ...args: Parameters<PlaybackEventCallback[E]>): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    (fns as Set<(...args: unknown[]) => void>).forEach((cb) => cb(...(args as unknown[])));
  }
}
