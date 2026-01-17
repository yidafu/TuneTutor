/**
 * Playback state types for the Music Notation Player
 */

import type { ParsedScore } from './notation';

/**
 * Loop range for section looping
 */
export interface LoopRange {
  startBeat: number;    // Start beat index (from 0)
  endBeat: number;      // End beat index
  skipBeats?: number;   // Number of beats to skip after playing (M)
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
  calculateTotalDuration: (score: ParsedScore, tempo: number) => number;
}
