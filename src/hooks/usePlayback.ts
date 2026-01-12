/**
 * usePlayback Hook - Manage playback state and control
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedScore } from '../types/notation';

interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasure: number;
  currentNoteIndex: number;
  progress: number; // 0-100
  currentTime: number; // seconds
  totalDuration: number; // seconds
  loopEnabled: boolean;
}

interface PlaybackActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: () => void;
  seek: (time: number) => void;
  calculateTotalDuration: (score: ParsedScore, tempo: number) => number;
}

export function usePlayback(): [PlaybackState, PlaybackActions] {
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentMeasure: -1,
    currentNoteIndex: -1,
    progress: 0,
    currentTime: 0,
    totalDuration: 0,
    loopEnabled: false,
  });

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  // Calculate total duration of measures
  const calculateTotalDuration = useCallback((score: ParsedScore, tempo: number = 120): number => {
    const secondsPerBeat = 60 / tempo;

    let total = 0;
    for (const measure of score.measures) {
      for (const note of measure.notes) {
        // Convert duration to beats
        const durationMap: Record<string, number> = {
          'w': 4,
          'h': 2,
          'q': 1,
          '8': 0.5,
          '16': 0.25,
        };
        const beats = durationMap[note.duration] || 1;
        total += beats * secondsPerBeat;
      }
    }
    return total;
  }, []);

  // Play
  const play = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      currentMeasure: 0,
      currentNoteIndex: -1,
    }));
    startTimeRef.current = Date.now();
    pauseTimeRef.current = 0;
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

  // Toggle loop
  const toggleLoop = useCallback(() => {
    setState((prev) => ({ ...prev, loopEnabled: !prev.loopEnabled }));
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
      const currentTime = pauseTimeRef.current > 0 ? elapsed - pauseTimeRef.current + pauseTimeRef.current : elapsed;

      setState((prev) => {
        if (prev.totalDuration === 0) return prev;

        const newProgress = (currentTime / prev.totalDuration) * 100;

        if (newProgress >= 100) {
          if (prev.loopEnabled) {
            // Restart playback
            startTimeRef.current = Date.now();
            return {
              ...prev,
              progress: 0,
              currentTime: 0,
              currentMeasure: 0,
              currentNoteIndex: -1,
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

        return {
          ...prev,
          progress: newProgress,
          currentTime,
        };
      });
    }, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isPlaying, state.loopEnabled, state.totalDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const actions: PlaybackActions = {
    play,
    pause,
    stop,
    toggleLoop,
    seek,
    calculateTotalDuration,
  };

  return [state, actions];
}

export default usePlayback;
