export const PLAYBACK_CONSTANTS = {
  TICK_DENOMINATOR: 1024 as number,
  LAST_TICK_OFFSET: 300 as number,
  DEFAULT_NOTE_VOLUME: 0.8 as number,
  ITERATION_SCHEDULE_AHEAD_MS: 35 as number,
  END_EVENT_DELAY_MS: 100 as number,
} as const;

export type PlaybackConstants = typeof PLAYBACK_CONSTANTS;
