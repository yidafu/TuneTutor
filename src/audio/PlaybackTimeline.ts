import {  getTransport } from 'tone';
import type { Note } from "opensheetmusicdisplay";
import type { TonejsPlayer } from "./TonejsPlayer";
import type { NotePlaybackInstruction } from "./TonejsPlayer";
import { ArticulationStyle } from "./TonejsPlayer";
import { PLAYBACK_CONSTANTS } from "./constants";
import { getVoiceEntryMidiInstrumentId } from "../types/osmd-extensions";

interface TimelineStep {
  stepIndex: number;
  tick: number;
  audioTime: number;
  notes: Note[];
}

export class PlaybackTimeline {
  private steps: TimelineStep[] = [];
  private scheduledEventIds: number[] = [];

  calculate(stepQueueSteps: { tick: number; notes: Note[] }[], wholeNoteLength: number): void {
    this.steps = [];
    const tickDuration = wholeNoteLength / PLAYBACK_CONSTANTS.TICK_DENOMINATOR;

    for (let i = 0; i < stepQueueSteps.length; i++) {
      const step = stepQueueSteps[i];
      this.steps.push({
        stepIndex: i,
        tick: step.tick,
        audioTime: step.tick * tickDuration,
        notes: step.notes,
      });
    }
  }

  scheduleAll(
    startFromStep: number,
    player: TonejsPlayer,
    wholeNoteLength: number,
    onIteration: (notes: Note[]) => void,
    onEnd: () => void,
    startPosition?: number
  ): void {
    this.cancelAll();

    const shouldResetTransport = startPosition === undefined;
    if (startPosition !== undefined) {
      getTransport().seconds = startPosition;
    }

    for (let i = startFromStep; i < this.steps.length; i++) {
      const step = this.steps[i];
      const audioTimeMs = step.audioTime;

      const iterationEventId = getTransport().schedule(() => {
        onIteration(step.notes);
      }, (audioTimeMs - PLAYBACK_CONSTANTS.ITERATION_SCHEDULE_AHEAD_MS) / 1000);
      this.scheduledEventIds.push(iterationEventId);

      const noteEventId = getTransport().schedule((time) => {
        this.triggerNotes(step.notes, wholeNoteLength, player, time);
      }, audioTimeMs / 1000);
      this.scheduledEventIds.push(noteEventId);
    }

    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      const endEventId = getTransport().schedule(() => {
        onEnd();
      }, (lastStep.audioTime + PLAYBACK_CONSTANTS.END_EVENT_DELAY_MS) / 1000);
      this.scheduledEventIds.push(endEventId);
    }

    if (shouldResetTransport) {
      getTransport().stop();
      getTransport().seconds = 0;
      getTransport().start();
    }
  }

  private triggerNotes(notes: Note[], wholeNoteLength: number, player: TonejsPlayer, time: number): void {
    const scheduledNotes: Map<number, NotePlaybackInstruction[]> = new Map();

    for (const note of notes) {
      if (note.isRest()) continue;

      const noteDuration = (note.Length.RealValue * wholeNoteLength) / 1000;
      if (noteDuration === 0) continue;

      const noteVolume = PLAYBACK_CONSTANTS.DEFAULT_NOTE_VOLUME;
      const midiPlaybackInstrument = getVoiceEntryMidiInstrumentId(note.ParentVoiceEntry!);
      if (midiPlaybackInstrument === undefined) continue;

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

    scheduledNotes.forEach((playbackNotes, midiId) => {
      player.schedule(midiId, time, playbackNotes);
    });
  }

  cancelAll(): void {
    for (const id of this.scheduledEventIds) {
      getTransport().clear(id);
    }
    this.scheduledEventIds = [];
    getTransport().cancel();
  }

  getStepCount(): number {
    return this.steps.length;
  }

  getAudioTimeForStep(stepIndex: number): number {
    return this.steps[stepIndex]?.audioTime ?? 0;
  }
}
