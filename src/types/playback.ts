/**
 * Playback state types for the Music Notation Player
 */

import type { InstrumentType } from './audio';

export type MetronomeSoundType = 'classic' | 'digital' | 'kick' | 'click';

/**
 * Loop skip-beat configuration (UI layer — keeps beat input for user)
 */
export interface LoopConfig {
  skipBeats: number;
}

/**
 * Metronome configuration
 */
export interface MetronomeConfig {
  enabled: boolean;
  sound: MetronomeSoundType;
  strongVolume: number;
  weakVolume: number;
}

/**
 * A single entry in the shared playback timeline.
 * Built once from OSMD cursor and used by both audio engine and UI.
 */
export interface TimelineEntry {
  /** Wall-clock offset from score start (seconds) */
  time: number;
  /** Duration of this entry (seconds) */
  duration: number;
  /** Measure index (0-based) */
  measureIndex: number;
  /** Global note index across the entire score (0-based) */
  noteIndex: number;
  /** MIDI note name (e.g. "C4") */
  noteName: string;
  /** Whether this entry is a rest (no audio) */
  isRest: boolean;
}

/**
 * Loop range for section looping — times in seconds.
 * Constructed from the shared TimelineEntry[] rather than from beat approximations.
 */
export interface LoopRange {
  startTime: number;    // Loop start (seconds)
  endTime: number;      // Loop end (seconds)
  skipTime: number;     // Beats to skip after each play cycle (seconds)
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasure: number;
  currentNoteIndex: number;
  progress: number; // 0-100
  currentTime: number; // seconds
  totalDuration: number; // seconds
  loopEnabled: boolean;
  loopRange: LoopRange | null; // Loop range for section looping
  metronomeEnabled: boolean;
  metronomeSound: MetronomeSoundType;
  metronomeStrongVolume: number; // 0-1
  metronomeWeakVolume: number;   // 0-1
  // Playback indicator position for vertical line
  indicatorX: number;
  indicatorRowTop: number;
  indicatorRowBottom: number;
}

export interface PlaybackActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: (range?: LoopRange | null) => void;
  setLoopRange: (range: LoopRange | null) => void;
  seek: (time: number) => void;
  setTimeline: (tl: TimelineEntry[]) => void;
  setInstrument: (type: InstrumentType) => void;
  toggleMetronome: () => void;
  setMetronomeSound: (sound: MetronomeSoundType) => void;
  setMetronomeStrongVolume: (volume: number) => void;
  setMetronomeWeakVolume: (volume: number) => void;
}
