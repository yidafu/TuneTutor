/**
 * useAudioEngine Hook - Web Audio API wrapper for Tone.js
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { InstrumentFactory, getInstrumentFactory } from '../utils/audio/InstrumentFactory';
import { noteToFrequency, durationToTone } from '../utils/audio/NoteMapper';
import type { InstrumentType } from '../types/audio';

const STORAGE_KEY = 'tune-tutor-instrument';

function getSavedInstrument(): InstrumentType {
  if (typeof window === 'undefined') return 'piano';
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved as InstrumentType) || 'piano';
}

function saveInstrument(type: InstrumentType): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, type);
  }
}

interface AudioEngineState {
  isReady: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  currentInstrument: InstrumentType;
  volume: number;
}

interface AudioEngineActions {
  init: () => Promise<void>;
  loadInstrument: (type: InstrumentType) => Promise<void>;
  playNote: (pitch: string, duration: string) => void;
  setInstrument: (type: InstrumentType) => void;
  setVolume: (volume: number) => void;
  resume: () => Promise<void>;
}

export function useAudioEngine(): [AudioEngineState, AudioEngineActions] {
  const [state, setState] = useState<AudioEngineState>({
    isReady: false,
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    error: null,
    currentInstrument: getSavedInstrument(),
    volume: 0,
  });

  const instrumentFactoryRef = useRef<InstrumentFactory | null>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);

  // Initialize the instrument factory
  const getFactory = useCallback(() => {
    if (!instrumentFactoryRef.current) {
      instrumentFactoryRef.current = getInstrumentFactory();
    }
    return instrumentFactoryRef.current;
  }, []);

  // Initialize audio context
  const init = useCallback(async () => {
    try {
      await Tone.start();
      setState((prev) => ({ ...prev, isReady: true, error: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize audio',
      }));
    }
  }, []);

  // Load an instrument
  const loadInstrument = useCallback(async (type: InstrumentType) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const factory = getFactory();

      // If we have a synth, dispose it
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }

      // Load the instrument
      await factory.loadInstrument(type);

      // Create a fallback synth for notes that don't have samples
      synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
      synthRef.current.volume.value = -10;

      // Save to localStorage
      saveInstrument(type);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentInstrument: type,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load instrument',
      }));
    }
  }, [getFactory]);

  // Play a note
  const playNote = useCallback((pitch: string, duration: string) => {
    const factory = getFactory();

    // Check if instrument is loaded
    if (!state.isReady || state.isLoading) {
      console.warn('Audio engine not ready');
      return;
    }

    // Try to play with the instrument factory first
    factory.playNote(pitch, duration);

    // Also play with synth for immediate feedback
    if (synthRef.current) {
      const frequency = noteToFrequency(pitch);
      const toneDuration = durationToTone(duration);
      synthRef.current.triggerAttackRelease(frequency, toneDuration);
    }
  }, [state.isReady, state.isLoading, getFactory]);

  // Set instrument
  const setInstrument = useCallback((type: InstrumentType) => {
    const factory = getFactory();
    factory.setInstrument(type);
    saveInstrument(type);
    setState((prev) => ({ ...prev, currentInstrument: type }));
  }, [getFactory]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    Tone.Destination.volume.value = volume;
    setState((prev) => ({ ...prev, volume }));
  }, []);

  // Resume audio context (needed after user interaction)
  const resume = useCallback(async () => {
    if (Tone.context.state === 'suspended') {
      await Tone.context.resume();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      instrumentFactoryRef.current?.dispose();
    };
  }, []);

  const actions: AudioEngineActions = {
    init,
    loadInstrument,
    playNote,
    setInstrument,
    setVolume,
    resume,
  };

  return [state, actions];
}

export default useAudioEngine;
