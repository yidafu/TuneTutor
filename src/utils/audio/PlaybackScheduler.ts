import type { VoiceEntry, Note } from "opensheetmusicdisplay";
import type { IAudioContext } from "standardized-audio-context";
import { StepQueue } from "./StepQueue";

type NoteSchedulingCallback = (delay: number, notes: Note[]) => void;

export class PlaybackScheduler {
  public wholeNoteLength: number;

  private stepQueue = new StepQueue();
  private stepQueueIndex = 0;
  private scheduledTicks = new Set<number>();

  private currentTick = 0;
  private currentTickTimestamp = 0;

  private schedulerIntervalHandle: number | null = null;
  private scheduleInterval = 200;
  private schedulePeriod = 500;
  private tickDenominator = 1024;

  private lastTickOffset = 300;
  private playing = false;

  private audioContext: IAudioContext;
  private audioContextStartTime = 0;

  private noteSchedulingCallback: NoteSchedulingCallback;

  constructor(wholeNoteLength: number, audioContext: IAudioContext, noteSchedulingCallback: NoteSchedulingCallback) {
    this.noteSchedulingCallback = noteSchedulingCallback;
    this.wholeNoteLength = wholeNoteLength;
    this.audioContext = audioContext;
  }

  get schedulePeriodTicks(): number {
    return this.schedulePeriod / this.tickDuration;
  }

  get audioContextTime(): number {
    if (!this.audioContext) return 0;
    return (this.audioContext.currentTime - this.audioContextStartTime) * 1000;
  }

  get tickDuration(): number {
    return this.wholeNoteLength / this.tickDenominator;
  }

  private get calculatedTick(): number {
    return this.currentTick + Math.round((this.audioContextTime - this.currentTickTimestamp) / this.tickDuration);
  }

  start() {
    this.playing = true;
    this.stepQueue.sort();
    this.audioContextStartTime = this.audioContext.currentTime;
    this.currentTickTimestamp = this.audioContextTime;
    if (!this.schedulerIntervalHandle) {
      this.schedulerIntervalHandle = window.setInterval(() => this.scheduleIterationStep(), this.scheduleInterval);
    }
  }

  setIterationStep(step: number) {
    step = Math.min(this.stepQueue.steps.length - 1, step);
    this.stepQueueIndex = step;
    this.currentTick = this.stepQueue.steps[this.stepQueueIndex].tick;
  }

  pause() {
    this.playing = false;
  }

  resume() {
    this.playing = true;
    this.currentTickTimestamp = this.audioContextTime;
  }

  reset() {
    this.playing = false;
    this.currentTick = 0;
    this.currentTickTimestamp = 0;
    this.stepQueueIndex = 0;
    if (this.schedulerIntervalHandle) {
      clearInterval(this.schedulerIntervalHandle);
      this.schedulerIntervalHandle = null;
    }
  }

  loadNotes(currentVoiceEntries: VoiceEntry[]) {
    let thisTick = this.lastTickOffset;
    if (this.stepQueue.steps.length > 0) {
      thisTick = this.stepQueue.getFirstEmptyTick();
    }

    for (const entry of currentVoiceEntries) {
      if (!entry.IsGrace) {
        for (const note of entry.Notes) {
          this.stepQueue.addNote(thisTick, note);
          this.stepQueue.createStep(thisTick + note.Length.RealValue * this.tickDenominator);
        }
      }
    }
  }

  private scheduleIterationStep() {
    if (!this.playing) return;
    this.currentTick = this.calculatedTick;
    this.currentTickTimestamp = this.audioContextTime;

    let nextTick = this.stepQueue.steps[this.stepQueueIndex]?.tick;
    while (this.nextTickAvailableAndWithinSchedulePeriod(nextTick)) {
      const step = this.stepQueue.steps[this.stepQueueIndex];

      let timeToTick = (step.tick - this.currentTick) * this.tickDuration;
      if (timeToTick < 0) timeToTick = 0;

      this.scheduledTicks.add(step.tick);
      this.noteSchedulingCallback(timeToTick / 1000, step.notes);

      this.stepQueueIndex++;
      nextTick = this.stepQueue.steps[this.stepQueueIndex]?.tick;
    }

    for (const tick of this.scheduledTicks) {
      if (tick <= this.currentTick) {
        this.scheduledTicks.delete(tick);
      }
    }
  }

  private nextTickAvailableAndWithinSchedulePeriod(nextTick: number | undefined): boolean {
    return (
      nextTick !== undefined &&
      this.currentTickTimestamp + (nextTick - this.currentTick) * this.tickDuration <=
        this.currentTickTimestamp + this.schedulePeriod
    );
  }
}