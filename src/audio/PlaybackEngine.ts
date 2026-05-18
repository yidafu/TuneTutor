import type { OpenSheetMusicDisplay, MusicSheet, Note, Instrument, Voice, Cursor } from "opensheetmusicdisplay";
import type { IAudioContext } from "standardized-audio-context";
import { AudioContext } from "standardized-audio-context";
import { PlaybackTimeline } from "./PlaybackTimeline";
import { StepQueue } from "./StepQueue";
import type { PlaybackInstrument } from "./SoundfontPlayer";
import { TonejsPlayer } from "./TonejsPlayer";

export const PlaybackState = {
  INIT: "INIT",
  PLAYING: "PLAYING",
  STOPPED: "STOPPED",
  PAUSED: "PAUSED",
} as const;

export type PlaybackState = typeof PlaybackState[keyof typeof PlaybackState];

export const PlaybackEvent = {
  STATE_CHANGE: "state-change",
  ITERATION: "iteration",
} as const;

export type PlaybackEvent = typeof PlaybackEvent[keyof typeof PlaybackEvent];

interface PlaybackSettings {
  bpm: number;
  masterVolume: number;
}

type EventCallback = (...args: unknown[]) => void;

export class PlaybackEngine {
  private ac: IAudioContext;
  private defaultBpm = 100;
  private cursor!: Cursor;
  private sheet!: MusicSheet;
  private timeline!: PlaybackTimeline;
  private stepQueue = new StepQueue();
  private instrumentPlayer: TonejsPlayer;

  private events: Map<PlaybackEvent, EventCallback[]> = new Map();

  private iterationSteps = 0;
  private currentIterationStep = 0;

  public playbackSettings: PlaybackSettings;
  public state: PlaybackState;
  public availableInstruments: PlaybackInstrument[] = [];
  public scoreInstruments: Instrument[] = [];
  public ready = false;

  constructor(context: IAudioContext = new AudioContext(), instrumentPlayer?: TonejsPlayer) {
    this.ac = context;
    this.ac.suspend();

    this.instrumentPlayer = instrumentPlayer ?? new TonejsPlayer();
    this.instrumentPlayer.init();

    this.availableInstruments = this.instrumentPlayer.instruments;

    this.iterationSteps = 0;
    this.currentIterationStep = 0;

    this.playbackSettings = {
      bpm: this.defaultBpm,
      masterVolume: 1,
    };

    this.state = PlaybackState.INIT;
  }

  get wholeNoteLength(): number {
    return Math.round((60 / this.playbackSettings.bpm) * 4000);
  }

  getPlaybackInstrument(voiceId: number): PlaybackInstrument | null {
    if (!this.sheet) return null;
    const voice = this.sheet.Instruments.flatMap(i => i.Voices).find(v => v.VoiceId === voiceId);
    return this.availableInstruments.find(i => i.midiId === (voice as unknown as { midiInstrumentId: number }).midiInstrumentId) ?? null;
  }

  async setInstrument(voice: Voice, midiInstrumentId: number): Promise<void> {
    await this.instrumentPlayer.load(midiInstrumentId);
    (voice as unknown as { midiInstrumentId: number }).midiInstrumentId = midiInstrumentId;
  }

  async loadScore(osmd: OpenSheetMusicDisplay): Promise<void> {
    this.ready = false;
    this.sheet = osmd.Sheet;
    this.scoreInstruments = this.sheet.Instruments;
    this.cursor = osmd.cursor;
    if (this.sheet.HasBPMInfo) {
      this.setBpm(this.sheet.DefaultStartTempoInBpm);
    }

    await this.loadInstruments();
    this.initInstruments();

    this.timeline = new PlaybackTimeline();

    this.countAndSetIterationSteps();
    this.timeline.calculate(this.stepQueue.steps, this.wholeNoteLength);

    this.ready = true;
    this.setState(PlaybackState.STOPPED);
  }

  private initInstruments() {
    for (const i of this.sheet.Instruments) {
      for (const v of i.Voices) {
        (v as unknown as { midiInstrumentId: number }).midiInstrumentId = i.MidiInstrumentId;
      }
    }
  }

  private async loadInstruments() {
    const playerPromises: Promise<void>[] = [];
    for (const i of this.sheet.Instruments) {
      const pbInstrument = this.availableInstruments.find(pbi => pbi.midiId === i.MidiInstrumentId);
      if (pbInstrument == null) {
        this.fallbackToPiano(i);
      }
      playerPromises.push(this.instrumentPlayer.load(i.MidiInstrumentId));
    }
    await Promise.all(playerPromises);
  }

  private fallbackToPiano(i: Instrument) {
    console.warn(`Can't find playback instrument for midiInstrumentId ${i.MidiInstrumentId}. Falling back to piano`);
    i.MidiInstrumentId = 0;

    if (this.availableInstruments.find(i => i.midiId === 0) == null) {
      throw new Error("Piano fallback failed, grand piano not supported");
    }
  }

  async play(): Promise<void> {
    await this.ac.resume();

    if (this.state === PlaybackState.INIT || this.state === PlaybackState.STOPPED) {
      this.cursor.show();
    }

    this.setState(PlaybackState.PLAYING);

    this.timeline.scheduleAll(
      this.currentIterationStep,
      this.instrumentPlayer,
      this.wholeNoteLength,
      (notes) => this.iterationCallback(notes),
      () => this.stop()
    );
  }

  async stop(): Promise<void> {
    this.setState(PlaybackState.STOPPED);
    this.stopPlayers();
    this.timeline.cancelAll();
    this.currentIterationStep = 0;
    this.cursor.reset();
    this.cursor.hide();
  }

  pause(): void {
    this.setState(PlaybackState.PAUSED);
    this.ac.suspend();
    this.stopPlayers();
    this.timeline.cancelAll();
  }

  jumpToStep(step: number): void {
    this.pause();
    if (this.currentIterationStep > step) {
      this.cursor.reset();
      this.currentIterationStep = 0;
    }
    while (this.currentIterationStep < step) {
      this.cursor.next();
      ++this.currentIterationStep;
    }
    this.timeline.calculate(this.stepQueue.steps, this.wholeNoteLength);
  }

  setBpm(bpm: number) {
    this.playbackSettings.bpm = bpm;
    if (this.timeline) {
      this.timeline.calculate(this.stepQueue.steps, this.wholeNoteLength);
    }
  }

  on(event: PlaybackEvent, cb: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(cb);
  }

  private emit(event: PlaybackEvent, ...args: unknown[]) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(...args);
      }
    }
  }

  private countAndSetIterationSteps() {
    this.stepQueue.steps = [];
    this.cursor.reset();
    let steps = 0;
    const lastTickOffset = 300;
    const tickDenominator = 1024;

    while (!this.cursor.Iterator.EndReached) {
      if (this.cursor.Iterator.CurrentVoiceEntries) {
        for (const entry of this.cursor.Iterator.CurrentVoiceEntries) {
          if (!entry.IsGrace) {
            let thisTick = lastTickOffset;
            if (this.stepQueue.steps.length > 0) {
              const emptySteps = this.stepQueue.steps.filter(s => !s.notes.length);
              thisTick = emptySteps.length > 0 ? emptySteps[0].tick : this.stepQueue.steps[this.stepQueue.steps.length - 1].tick;
            }

            for (const note of entry.Notes) {
              this.stepQueue.addNote(thisTick, note);
              this.stepQueue.createStep(thisTick + note.Length.RealValue * tickDenominator);
            }
          }
        }
      }
      this.cursor.next();
      ++steps;
    }
    this.iterationSteps = steps;
    console.log(`[Playback] Total iteration steps: ${steps}`);
    this.cursor.reset();
  }

  private setState(state: PlaybackState) {
    this.state = state;
    this.emit(PlaybackEvent.STATE_CHANGE, state);
  }

  private stopPlayers() {
    for (const i of this.sheet.Instruments) {
      for (const v of i.Voices) {
        this.instrumentPlayer.stop((v as unknown as { midiInstrumentId: number }).midiInstrumentId);
      }
    }
  }

  private iterationCallback(notes: Note[]) {
    if (this.state !== PlaybackState.PLAYING) return;

    if (this.currentIterationStep >= this.iterationSteps) {
      console.log(`[Playback] Reached end at step ${this.currentIterationStep}, stopping`);
      this.stop();
      return;
    }

    console.log(`[Playback] Step ${this.currentIterationStep} / ${this.iterationSteps}`);
    if (this.currentIterationStep > 0) {
      this.cursor.next();
    }

    this.emit(PlaybackEvent.ITERATION, notes);
    ++this.currentIterationStep;
  }
}
