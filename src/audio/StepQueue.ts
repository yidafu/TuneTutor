import type { Note } from "opensheetmusicdisplay";

type ScheduledNotes = {
  tick: number;
  notes: Note[];
};

export class StepQueue {
  private stepsByTick: Map<number, ScheduledNotes> = new Map();
  private _steps: ScheduledNotes[] = [];

  [Symbol.iterator]() {
    return this._steps.values();
  }

  get steps(): ScheduledNotes[] {
    return this._steps;
  }

  set steps(newSteps: ScheduledNotes[]) {
    this._steps = newSteps.sort((a, b) => a.tick - b.tick);
    this.stepsByTick.clear();
    for (const step of this._steps) {
      this.stepsByTick.set(step.tick, step);
    }
  }

  clear(): void {
    this._steps = [];
    this.stepsByTick.clear();
  }

  createStep(tick: number): ScheduledNotes {
    let step = this.stepsByTick.get(tick);
    if (!step) {
      step = { tick, notes: [] };
      this.stepsByTick.set(tick, step);
      this._steps.push(step);
      this._steps.sort((a, b) => a.tick - b.tick);
    }
    return step;
  }

  addNote(tick: number, note: Note): void {
    let step = this.stepsByTick.get(tick);
    if (!step) {
      step = this.createStep(tick);
    }
    step.notes.push(note);
  }

  delete(value: ScheduledNotes): void {
    this.stepsByTick.delete(value.tick);
    const index = this._steps.findIndex(v => v.tick === value.tick);
    if (index !== -1) this._steps.splice(index, 1);
  }

  getFirstEmptyTick(): number | null {
    for (const step of this._steps) {
      if (step.notes.length === 0) {
        return step.tick;
      }
    }
    return null;
  }
}
