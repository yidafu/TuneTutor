import type { OpenSheetMusicDisplay, MusicSheet, Note, Instrument, Voice, Cursor } from "opensheetmusicdisplay";
import type { IAudioContext } from "standardized-audio-context";
import { AudioContext } from "standardized-audio-context";
import { PlaybackScheduler } from "./PlaybackScheduler";
import type { PlaybackInstrument, NotePlaybackInstruction } from "./SoundfontPlayer";
import { SoundfontPlayer, ArticulationStyle } from "./SoundfontPlayer";

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
  private scheduler!: PlaybackScheduler;
  private instrumentPlayer: SoundfontPlayer;

  private events: Map<PlaybackEvent, EventCallback[]> = new Map();

  private iterationSteps = 0;
  private currentIterationStep = 0;

  private timeoutHandles: number[] = [];

  public playbackSettings: PlaybackSettings;
  public state: PlaybackState;
  public availableInstruments: PlaybackInstrument[] = [];
  public scoreInstruments: Instrument[] = [];
  public ready = false;

  constructor(context: IAudioContext = new AudioContext(), instrumentPlayer?: SoundfontPlayer) {
    this.ac = context;
    this.ac.suspend();

    this.instrumentPlayer = instrumentPlayer ?? new SoundfontPlayer();
    this.instrumentPlayer.init(this.ac);

    this.availableInstruments = this.instrumentPlayer.instruments;

    this.iterationSteps = 0;
    this.currentIterationStep = 0;

    this.timeoutHandles = [];

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

    this.scheduler = new PlaybackScheduler(this.wholeNoteLength, this.ac, (delay, notes) =>
      this.notePlaybackCallback(delay, notes)
    );

    this.countAndSetIterationSteps();
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
    this.scheduler.start();
  }

  async stop(): Promise<void> {
    this.setState(PlaybackState.STOPPED);
    this.stopPlayers();
    this.clearTimeouts();
    this.scheduler.reset();
    this.cursor.reset();
    this.currentIterationStep = 0;
    this.cursor.hide();
  }

  pause(): void {
    this.setState(PlaybackState.PAUSED);
    this.ac.suspend();
    this.stopPlayers();
    this.scheduler.setIterationStep(this.currentIterationStep);
    this.scheduler.pause();
    this.clearTimeouts();
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
    let schedulerStep = this.currentIterationStep;
    if (this.currentIterationStep > 0 && this.currentIterationStep < this.iterationSteps) ++schedulerStep;
    this.scheduler.setIterationStep(schedulerStep);
  }

  setBpm(bpm: number) {
    this.playbackSettings.bpm = bpm;
    if (this.scheduler) this.scheduler.wholeNoteLength = this.wholeNoteLength;
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
    this.cursor.reset();
    let steps = 0;
    while (!this.cursor.Iterator.EndReached) {
      if (this.cursor.Iterator.CurrentVoiceEntries) {
        this.scheduler.loadNotes(this.cursor.Iterator.CurrentVoiceEntries);
      }
      this.cursor.next();
      ++steps;
    }
    this.iterationSteps = steps;
    this.cursor.reset();
  }

  private getNoteDuration(note: Note): number {
    return (note.Length.RealValue * this.wholeNoteLength) / 1000;
  }

  private getNoteVolume(_note: Note): number {
    return 0.8;
  }

  private notePlaybackCallback(audioDelay: number, notes: Note[]) {
    if (this.state !== PlaybackState.PLAYING) return;
    const scheduledNotes: Map<number, NotePlaybackInstruction[]> = new Map();

    for (const note of notes) {
      if (note.isRest()) {
        continue;
      }
      const noteDuration = this.getNoteDuration(note);
      if (noteDuration === 0) continue;
      const noteVolume = this.getNoteVolume(note);

      const midiPlaybackInstrument = (note.ParentVoiceEntry?.ParentVoice as unknown as { midiInstrumentId: number })?.midiInstrumentId;
      const fixedKey = note.ParentVoiceEntry?.ParentVoice?.Parent?.SubInstruments?.[0]?.fixedKey || 0;

      if (!scheduledNotes.has(midiPlaybackInstrument)) {
        scheduledNotes.set(midiPlaybackInstrument, []);
      }

      scheduledNotes.get(midiPlaybackInstrument)!.push({
        note: note.halfTone - fixedKey * 12,
        duration: noteDuration,
        gain: noteVolume,
        articulation: ArticulationStyle.Normal,
      });
    }

    for (const [midiId, playbackNotes] of scheduledNotes) {
      this.instrumentPlayer.schedule(midiId, this.ac.currentTime + audioDelay, playbackNotes);
    }

    this.timeoutHandles.push(
      window.setTimeout(() => this.iterationCallback(), Math.max(0, audioDelay * 1000 - 35)),
      window.setTimeout(() => this.emit(PlaybackEvent.ITERATION, notes), audioDelay * 1000)
    );
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

  private clearTimeouts() {
    for (const h of this.timeoutHandles) {
      clearTimeout(h);
    }
    this.timeoutHandles = [];
  }

  private iterationCallback() {
    if (this.state !== PlaybackState.PLAYING) return;
    if (this.currentIterationStep > 0) this.cursor.next();
    ++this.currentIterationStep;
  }
}