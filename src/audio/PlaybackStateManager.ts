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

type EventCallback = (...args: unknown[]) => void;

export class PlaybackStateManager {
  private _state: PlaybackState = PlaybackState.INIT;
  private events: Map<PlaybackEvent, EventCallback[]> = new Map();

  get state(): PlaybackState {
    return this._state;
  }

  setState(state: PlaybackState): void {
    this._state = state;
    this.emit(PlaybackEvent.STATE_CHANGE, state);
  }

  on(event: PlaybackEvent, cb: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(cb);
  }

  emit(event: PlaybackEvent, ...args: unknown[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(...args);
      }
    }
  }
}
