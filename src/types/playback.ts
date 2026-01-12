/**
 * Playback state types for the Music Notation Player
 */

export type PlaybackAction = 'play' | 'pause' | 'stop' | 'none';

export interface SelectionState {
  selectedMeasures: number[]; // Array of measure indices
  anchorMeasure: number | null; // Starting point for range selection
  isRangeSelecting: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasure: number;
  progress: number; // 0-100
  currentTime: number; // seconds
  totalDuration: number; // seconds
  loopEnabled: boolean;
}

export interface TempoPreset {
  label: string;
  bpm: number;
}

export const TEMPO_PRESETS: TempoPreset[] = [
  { label: 'Largo', bpm: 60 },
  { label: 'Andante', bpm: 80 },
  { label: 'Moderato', bpm: 120 },
  { label: 'Allegro', bpm: 160 },
];

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 240;
export const DEFAULT_TEMPO = 120;

export const MIN_MEASURE_INTERVAL = 0;
export const MAX_MEASURE_INTERVAL = 8;
export const DEFAULT_MEASURE_INTERVAL = 0;

export const MEASURE_INTERVAL_PRESETS = [0, 1, 2, 4, 8];
