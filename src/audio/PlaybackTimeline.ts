import * as Tone from 'tone';
import type { Note } from "opensheetmusicdisplay";
import type { TonejsPlayer } from "./TonejsPlayer";
import type { NotePlaybackInstruction } from "./SoundfontPlayer";
import { ArticulationStyle } from "./SoundfontPlayer";

interface TimelineStep {
  stepIndex: number;
  tick: number;
  audioTime: number;
  notes: Note[];
}

export class PlaybackTimeline {
  private steps: TimelineStep[] = [];
  private scheduledEventIds: number[] = [];
  private tickDenominator = 1024;

  calculate(stepQueueSteps: { tick: number; notes: Note[] }[], wholeNoteLength: number): void {
    this.steps = [];
    const tickDuration = wholeNoteLength / this.tickDenominator;

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
    onEnd: () => void
  ): void {
    this.cancelAll();

    for (let i = startFromStep; i < this.steps.length; i++) {
      const step = this.steps[i];
      const audioTimeMs = step.audioTime;

      const iterationEventId = Tone.Transport.schedule(() => {
        onIteration(step.notes);
      }, (audioTimeMs - 35) / 1000);
      this.scheduledEventIds.push(iterationEventId);

      const noteEventId = Tone.Transport.schedule((time) => {
        this.triggerNotes(step.notes, wholeNoteLength, player, time);
      }, audioTimeMs / 1000);
      this.scheduledEventIds.push(noteEventId);
    }

    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      const endEventId = Tone.Transport.schedule(() => {
        onEnd();
      }, (lastStep.audioTime + 100) / 1000);
      this.scheduledEventIds.push(endEventId);
    }

    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    Tone.Transport.start();
  }

  private triggerNotes(notes: Note[], wholeNoteLength: number, player: TonejsPlayer, time: number): void {
    const scheduledNotes: Map<number, NotePlaybackInstruction[]> = new Map();

    for (const note of notes) {
      if (note.isRest()) continue;

      const noteDuration = (note.Length.RealValue * wholeNoteLength) / 1000;
      if (noteDuration === 0) continue;

      const noteVolume = 0.8;
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
      player.schedule(midiId, time, playbackNotes);
    }
  }

  cancelAll(): void {
    for (const id of this.scheduledEventIds) {
      Tone.Transport.clear(id);
    }
    this.scheduledEventIds = [];
    Tone.Transport.cancel();
  }

  getStepCount(): number {
    return this.steps.length;
  }

  getAudioTimeForStep(stepIndex: number): number {
    return this.steps[stepIndex]?.audioTime ?? 0;
  }
}
