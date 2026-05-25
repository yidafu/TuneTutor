import * as Tone from 'tone';
import type { OpenSheetMusicDisplay, MusicSheet, Note, Voice, Cursor } from "opensheetmusicdisplay";
import type { IAudioContext } from "standardized-audio-context";
import { AudioContext } from "standardized-audio-context";
import { PlaybackTimeline } from "./PlaybackTimeline";
import { StepQueue } from "./StepQueue";
import type { PlaybackInstrument } from "./TonejsPlayer";
import { TonejsPlayer } from "./TonejsPlayer";
import { InstrumentManager } from "./InstrumentManager";
import { PlaybackStateManager, PlaybackState, PlaybackEvent } from "./PlaybackStateManager";
import { PLAYBACK_CONSTANTS } from "./constants";

export { PlaybackState, PlaybackEvent };

export interface PlaybackSettings {
  bpm: number;
  masterVolume: number;
}

export class PlaybackEngine {
  private ac: IAudioContext;
  private defaultBpm = 100;
  private cursor!: Cursor;
  private sheet!: MusicSheet;
  private timeline!: PlaybackTimeline;
  private stepQueue = new StepQueue();
  private instrumentPlayer: TonejsPlayer;
  private instrumentManager: InstrumentManager;
  private stateManager: PlaybackStateManager;

  private iterationSteps = 0;
  private currentIterationStep = 0;
  private transportPositionBeforePause = 0;

  public playbackSettings: PlaybackSettings;
  public ready = false;

  constructor(context: IAudioContext = new AudioContext(), instrumentPlayer?: TonejsPlayer) {
    this.ac = context;
    this.ac.suspend();

    this.instrumentPlayer = instrumentPlayer ?? new TonejsPlayer();
    this.instrumentPlayer.init();

    this.instrumentManager = new InstrumentManager(this.instrumentPlayer);
    this.stateManager = new PlaybackStateManager();

    this.iterationSteps = 0;
    this.currentIterationStep = 0;

    this.playbackSettings = {
      bpm: this.defaultBpm,
      masterVolume: 1,
    };
  }

  get state(): PlaybackState {
    return this.stateManager.state;
  }

  get availableInstruments(): PlaybackInstrument[] {
    return this.instrumentManager.availableInstruments;
  }

  get scoreInstruments() {
    return this.sheet?.Instruments ?? [];
  }

  get wholeNoteLength(): number {
    return Math.round((60 / this.playbackSettings.bpm) * 4000);
  }

  getPlaybackInstrument(voiceId: number): PlaybackInstrument | null {
    if (!this.sheet) return null;
    return this.instrumentManager.getPlaybackInstrumentForVoice(
      voiceId,
      this.sheet.Instruments,
      this.availableInstruments
    );
  }

  async setInstrument(voice: Voice, midiInstrumentId: number): Promise<void> {
    await this.instrumentPlayer.load(midiInstrumentId);
    this.instrumentManager.setVoiceMidiInstrument(voice, midiInstrumentId);
  }

  async loadScore(osmd: OpenSheetMusicDisplay): Promise<void> {
    this.ready = false;
    this.sheet = osmd.Sheet;
    this.cursor = osmd.cursor;
    if (this.sheet.HasBPMInfo) {
      this.setBpm(this.sheet.DefaultStartTempoInBpm);
    }

    await this.instrumentManager.loadInstruments(this.sheet.Instruments);
    this.instrumentManager.initInstrumentsForSheet(this.sheet.Instruments);

    this.timeline = new PlaybackTimeline();

    this.countAndSetIterationSteps();
    this.timeline.calculate(this.stepQueue.steps, this.wholeNoteLength);

    this.ready = true;
    this.stateManager.setState(PlaybackState.STOPPED);
  }

  async play(): Promise<void> {
    await this.ac.resume();

    if (this.state === PlaybackState.INIT || this.state === PlaybackState.STOPPED) {
      this.cursor.show();
      this.timeline.scheduleAll(
        0,
        this.instrumentPlayer,
        this.wholeNoteLength,
        (notes) => this.iterationCallback(notes),
        () => this.stop()
      );
    } else if (this.state === PlaybackState.PAUSED) {
      this.timeline.scheduleAll(
        this.currentIterationStep,
        this.instrumentPlayer,
        this.wholeNoteLength,
        (notes) => this.iterationCallback(notes),
        () => this.stop(),
        this.transportPositionBeforePause
      );
    }

    this.stateManager.setState(PlaybackState.PLAYING);
  }

  async stop(): Promise<void> {
    this.stateManager.setState(PlaybackState.STOPPED);
    this.instrumentManager.stopAll(this.sheet.Instruments);
    this.timeline.cancelAll();
    this.currentIterationStep = 0;
    this.transportPositionBeforePause = 0;
    this.cursor.reset();
    this.cursor.hide();
  }

  pause(): void {
    this.transportPositionBeforePause = Tone.Transport.seconds;
    this.stateManager.setState(PlaybackState.PAUSED);
    this.ac.suspend();
    this.instrumentManager.stopAll(this.sheet.Instruments);
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

  on(event: PlaybackEvent, cb: (...args: unknown[]) => void) {
    this.stateManager.on(event, cb);
  }

  private countAndSetIterationSteps() {
    this.stepQueue.steps = [];
    this.cursor.reset();
    let steps = 0;

    while (!this.cursor.Iterator.EndReached) {
      if (this.cursor.Iterator.CurrentVoiceEntries) {
        for (const entry of this.cursor.Iterator.CurrentVoiceEntries) {
          if (!entry.IsGrace) {
            let thisTick = PLAYBACK_CONSTANTS.LAST_TICK_OFFSET;
            if (this.stepQueue.steps.length > 0) {
              const emptyTick = this.stepQueue.getFirstEmptyTick();
              thisTick = emptyTick !== null ? emptyTick : this.stepQueue.steps[this.stepQueue.steps.length - 1].tick;
            }

            for (const note of entry.Notes) {
              this.stepQueue.addNote(thisTick, note);
              this.stepQueue.createStep(thisTick + note.Length.RealValue * PLAYBACK_CONSTANTS.TICK_DENOMINATOR);
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

    this.stateManager.emit(PlaybackEvent.ITERATION, notes);
    ++this.currentIterationStep;
  }
}
