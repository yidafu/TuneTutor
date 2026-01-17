/**
 * usePlayback Hook - Manage playback state and control
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ParsedScore } from '../types/notation';
import type { PlaybackState, PlaybackActions, LoopRange } from '../types/playback';
import { calculateTotalDuration as calculateDurationFromMeasures, noteDurationToSeconds, beatsToSeconds } from '../utils/audio/TempoConverter';

// Helper to calculate current note index and progress within note from time
function calculateNotePosition(
  score: ParsedScore,
  currentTime: number,
  tempo: number
): { measureIndex: number; noteIndex: number; progressInNote: number } {
  const [, beatValue] = score.timeSignature.split('/').map(Number);
  let elapsedTime = 0;

  for (let m = 0; m < score.measures.length; m++) {
    const measure = score.measures[m];
    for (let n = 0; n < measure.notes.length; n++) {
      const note = measure.notes[n];
      const noteDuration = noteDurationToSeconds(note.duration, tempo, beatValue);

      if (currentTime >= elapsedTime && currentTime < elapsedTime + noteDuration) {
        return {
          measureIndex: m,
          noteIndex: n,
          progressInNote: (currentTime - elapsedTime) / noteDuration,
        };
      }
      elapsedTime += noteDuration;
    }
  }

  // If time is beyond all notes, return last note
  const lastMeasure = score.measures[score.measures.length - 1];
  if (lastMeasure.notes.length > 0) {
    return {
      measureIndex: score.measures.length - 1,
      noteIndex: lastMeasure.notes.length - 1,
      progressInNote: 1,
    };
  }

  return { measureIndex: 0, noteIndex: 0, progressInNote: 0 };
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
    loopRange: null,
    indicatorX: 0,
    indicatorRowTop: 0,
    indicatorRowBottom: 0,
  });

  // Store score and tempo for position calculation
  const scoreRef = useRef<ParsedScore | null>(null);
  const tempoRef = useRef<number>(120);

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const loopCycleStartRef = useRef<number>(0);  // Start time of current loop cycle

  // Calculate total duration of measures
  const calculateTotalDuration = useCallback((score: ParsedScore, tempo: number = 120): number => {
    scoreRef.current = score;
    tempoRef.current = tempo;
    return calculateDurationFromMeasures(score.measures, tempo, score.timeSignature);
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
    loopCycleStartRef.current = Date.now();
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
      const currentTime = pauseTimeRef.current > 0 ? elapsed - pauseTimeRef.current + pauseTimeRef.current : elapsed;

      setState((prev) => {
        if (prev.totalDuration === 0) return prev;

        const newProgress = (currentTime / prev.totalDuration) * 100;

        // Check if we need to loop with skip (N play, M skip)
        if (prev.loopEnabled && prev.loopRange && scoreRef.current) {
          // playDuration from startBeat to endBeat
          const playBeats = prev.loopRange.endBeat - prev.loopRange.startBeat;
          // Convert beats directly to seconds
          const playDuration = beatsToSeconds(playBeats, tempoRef.current, 4);
          // Use skipBeats from loopRange
          const skipBeats = prev.loopRange.skipBeats || playBeats;
          const skipDuration = beatsToSeconds(skipBeats, tempoRef.current, 4);
          const cycleDuration = playDuration + skipDuration;

          // Calculate cycle position using modulo
          const cycleTime = currentTime % cycleDuration;

          if (cycleTime >= playDuration) {
            // Skip phase - we're waiting, position indicator at the end of play range
            const skipProgress = (playDuration / prev.totalDuration) * 100;
            return {
              ...prev,
              progress: skipProgress,
              currentTime: playDuration,
              currentMeasure: prev.loopRange.endBeat,
              currentNoteIndex: -1,
            };
          }

          // Play phase - show current position
          const startBeatOffset = beatsToSeconds(prev.loopRange.startBeat, tempoRef.current, 4);
          const positionTime = cycleTime + startBeatOffset;
          const { measureIndex, noteIndex } = calculateNotePosition(
            scoreRef.current,
            positionTime,
            tempoRef.current
          );
          return {
            ...prev,
            progress: (cycleTime / prev.totalDuration) * 100,
            currentTime: cycleTime,
            currentMeasure: measureIndex,
            currentNoteIndex: noteIndex,
          };
        }

        if (newProgress >= 100) {
          if (prev.loopEnabled) {
            // Restart playback from beginning
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
        const { measureIndex, noteIndex } = scoreRef.current
          ? calculateNotePosition(scoreRef.current, currentTime, tempoRef.current)
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
    calculateTotalDuration,
  }), [calculateTotalDuration, pause, play, seek, setLoopRange, stop, toggleLoop]);

  return [state, actions];
}

export default usePlayback;
