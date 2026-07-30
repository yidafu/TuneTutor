/**
 * usePlayback Hook - Manage playback state, control, and audio preferences
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { PlaybackState, PlaybackActions, LoopRange, MetronomeSoundType, TimelineEntry } from '../types/playback';
import type { InstrumentType } from '../types/audio';
import { getSavedInstrument, saveInstrument } from '../types/audio';
import { isBrowser } from '../utils/isBrowser';

const METRONOME_SOUND_KEY = 'note-slice-metronome-sound';
const METRONOME_STRONG_VOL_KEY = 'note-slice-metronome-strong-volume';
const METRONOME_WEAK_VOL_KEY = 'note-slice-metronome-weak-volume';

function getSavedMetronomeSound(): MetronomeSoundType {
  if (!isBrowser) return 'classic';
  const saved = localStorage.getItem(METRONOME_SOUND_KEY);
  if (saved === 'classic' || saved === 'digital' || saved === 'kick' || saved === 'click') {
    return saved;
  }
  return 'classic';
}

function getSavedMetronomeStrongVolume(): number {
  if (!isBrowser) return 0.8;
  const saved = localStorage.getItem(METRONOME_STRONG_VOL_KEY);
  return saved ? parseFloat(saved) : 0.8;
}

function getSavedMetronomeWeakVolume(): number {
  if (!isBrowser) return 0.5;
  const saved = localStorage.getItem(METRONOME_WEAK_VOL_KEY);
  return saved ? parseFloat(saved) : 0.5;
}

// Helper to calculate current note index and progress within note from time
// Uses binary search on the shared timeline (single source of truth).
function calculateNotePositionFromTimeline(
  timeline: TimelineEntry[],
  currentTime: number,
): { measureIndex: number; noteIndex: number; progressInNote: number } {
  if (timeline.length === 0) return { measureIndex: 0, noteIndex: 0, progressInNote: 0 };

  let lo = 0;
  let hi = timeline.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = timeline[mid];
    if (currentTime >= entry.time && currentTime < entry.time + entry.duration) {
      return {
        measureIndex: entry.measureIndex,
        noteIndex: entry.noteIndex,
        progressInNote: (currentTime - entry.time) / entry.duration,
      };
    }
    if (currentTime < entry.time) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // currentTime falls between entries — return the preceding entry
  const prev = timeline[Math.min(hi, timeline.length - 1)];
  if (prev) {
    return { measureIndex: prev.measureIndex, noteIndex: prev.noteIndex, progressInNote: 1 };
  }
  return { measureIndex: 0, noteIndex: 0, progressInNote: 0 };
}

export function usePlayback(): [PlaybackState, PlaybackActions, InstrumentType] {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentMeasure: -1,
    currentNoteIndex: -1,
    progress: 0,
    currentTime: 0,
    totalDuration: 0,
    loopEnabled: false,
    loopRange: null,
    metronomeEnabled: false,
    metronomeSound: getSavedMetronomeSound(),
    metronomeStrongVolume: getSavedMetronomeStrongVolume(),
    metronomeWeakVolume: getSavedMetronomeWeakVolume(),
    indicatorX: 0,
    indicatorRowTop: 0,
    indicatorRowBottom: 0,
  });

  // Audio preferences
  const [currentInstrument, setCurrentInstrumentState] = useState<InstrumentType>(getSavedInstrument());

  const setInstrument = useCallback((type: InstrumentType) => {
    saveInstrument(type);
    setCurrentInstrumentState(type);
  }, []);

  const toggleMetronome = useCallback(() => {
    setState((prev) => ({
      ...prev,
      metronomeEnabled: !prev.metronomeEnabled,
    }));
  }, []);

  const setMetronomeSound = useCallback((sound: MetronomeSoundType) => {
    setState((prev) => ({
      ...prev,
      metronomeSound: sound,
    }));
    if (isBrowser) {
      localStorage.setItem(METRONOME_SOUND_KEY, sound);
    }
  }, []);

  const setMetronomeStrongVolume = useCallback((volume: number) => {
    setState((prev) => ({
      ...prev,
      metronomeStrongVolume: volume,
    }));
    if (isBrowser) {
      localStorage.setItem(METRONOME_STRONG_VOL_KEY, String(volume));
    }
  }, []);

  const setMetronomeWeakVolume = useCallback((volume: number) => {
    setState((prev) => ({
      ...prev,
      metronomeWeakVolume: volume,
    }));
    if (isBrowser) {
      localStorage.setItem(METRONOME_WEAK_VOL_KEY, String(volume));
    }
  }, []);

  // Store timeline for position calculation
  const timelineRef = useRef<TimelineEntry[]>([]);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  // Set timeline (called by App.tsx after OSMD renders or tempo changes)
  const setTimeline = useCallback((tl: TimelineEntry[]) => {
    timelineRef.current = tl;
    const total = tl.length > 0
      ? tl[tl.length - 1].time + tl[tl.length - 1].duration
      : 0;
    setState((prev) => ({ ...prev, totalDuration: total }));
  }, []);

  // Play (or resume from pause)
  const play = useCallback(() => {
    const now = Date.now();
    // Resume from pause: advance startTime by the paused duration so elapsed
    // wall-clock time correctly excludes time spent paused.
    if (pauseTimeRef.current > 0) {
      const pauseDuration = now - pauseTimeRef.current;
      startTimeRef.current += pauseDuration;
    } else {
      startTimeRef.current = now;
    }
    pauseTimeRef.current = 0;

    setState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      currentMeasure: prev.currentMeasure === -1 ? 0 : prev.currentMeasure,
      currentNoteIndex: prev.currentNoteIndex === -1 ? -1 : prev.currentNoteIndex,
    }));
  }, []);

  // Pause
  const pause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: true,
    }));
    pauseTimeRef.current = Date.now();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Stop
  const stop = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentMeasure: -1,
      currentNoteIndex: -1,
      progress: 0,
      currentTime: 0,
    }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Toggle loop - optionally set loop range
  const toggleLoop = useCallback((range?: LoopRange | null) => {
    setState((prev) => {
      const newLoopEnabled = range ? !prev.loopEnabled : !prev.loopEnabled;
      return {
        ...prev,
        loopEnabled: newLoopEnabled,
        loopRange: newLoopEnabled && range ? range : prev.loopRange,
      };
    });
  }, []);

  // Set loop range directly
  const setLoopRange = useCallback((range: LoopRange | null) => {
    setState((prev) => ({
      ...prev,
      loopRange: range,
      loopEnabled: range !== null,
    }));
  }, []);

  // Seek
  const seek = useCallback((time: number) => {
    setState((prev) => ({
      ...prev,
      currentTime: time,
      progress: prev.totalDuration > 0 ? (time / prev.totalDuration) * 100 : 0,
    }));
  }, []);

  // Update progress
  useEffect(() => {
    if (!state.isPlaying) return;

    intervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentTime = elapsed;

      setState((prev) => {
        if (prev.totalDuration === 0) return prev;

        const newProgress = (currentTime / prev.totalDuration) * 100;

        // Loop with skip (range-based)
        if (prev.loopEnabled && prev.loopRange && timelineRef.current.length > 0) {
          const playDuration = prev.loopRange.endTime - prev.loopRange.startTime;
          const skipTime = prev.loopRange.skipTime;
          const cycleDuration = playDuration + skipTime;
          const cycleTime = currentTime % cycleDuration;

          if (cycleTime >= playDuration) {
            // Skip phase — indicator pauses at loop end
            return {
              ...prev,
              progress: (playDuration / prev.totalDuration) * 100,
              currentTime: playDuration,
              currentMeasure: -1,
              currentNoteIndex: -1,
            };
          }

          // Play phase
          const positionTime = cycleTime + prev.loopRange.startTime;
          const { measureIndex, noteIndex } = calculateNotePositionFromTimeline(
            timelineRef.current,
            positionTime,
          );
          return {
            ...prev,
            progress: (currentTime / prev.totalDuration) * 100,
            currentTime,
            currentMeasure: measureIndex,
            currentNoteIndex: noteIndex,
          };
        }

        if (newProgress >= 100) {
          if (prev.loopEnabled) {
            // Restart playback from beginning (full-score loop)
            startTimeRef.current = Date.now();
            return {
              ...prev,
              progress: 0,
              currentTime: 0,
              currentMeasure: 0,
              currentNoteIndex: -1,
              indicatorX: 0,
            };
          } else {
            // Stop playback
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return {
              ...prev,
              isPlaying: false,
              progress: 100,
              currentTime: prev.totalDuration,
            };
          }
        }

        // Calculate current note position for indicator
        const { measureIndex, noteIndex } = timelineRef.current.length > 0
          ? calculateNotePositionFromTimeline(timelineRef.current, currentTime)
          : { measureIndex: 0, noteIndex: 0 };

        return {
          ...prev,
          progress: newProgress,
          currentTime,
          currentMeasure: measureIndex,
          currentNoteIndex: noteIndex,
        };
      });
    }, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isPlaying, state.loopEnabled, state.loopRange, state.totalDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const actions: PlaybackActions = useMemo(() => ({
    play,
    pause,
    stop,
    toggleLoop,
    setLoopRange,
    seek,
    setTimeline,
    setInstrument,
    toggleMetronome,
    setMetronomeSound,
    setMetronomeStrongVolume,
    setMetronomeWeakVolume,
  }), [pause, play, seek, setLoopRange, setTimeline, stop, toggleLoop, setInstrument, toggleMetronome, setMetronomeSound, setMetronomeStrongVolume, setMetronomeWeakVolume]);

  return [state, actions, currentInstrument];
}

export default usePlayback;
