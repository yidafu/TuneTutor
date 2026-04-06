/**
 * useAudioEngine Hook - Web Audio API for immediate note playback
 * Uses SoundfontPlayer for realistic instrument sounds
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioContext } from 'standardized-audio-context';
import type { IAudioContext } from 'standardized-audio-context';
import { noteToFrequency } from '../utils/audio/NoteMapper';
import { SoundfontPlayer, type NotePlaybackInstruction } from '../utils/audio/SoundfontPlayer';
import type { InstrumentType } from '../types/audio';
import { INSTRUMENT_TO_MIDI } from '../types/audio';

const STORAGE_KEY = 'note-slice-preferred-instrument';

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
    volume: 1,
  });

  const audioContextRef = useRef<IAudioContext | null>(null);
  const soundfontPlayerRef = useRef<SoundfontPlayer | null>(null);
  const currentMidiRef = useRef<number>(INSTRUMENT_TO_MIDI[getSavedInstrument()]);

  // Initialize audio context and soundfont player on mount
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (!soundfontPlayerRef.current) {
      soundfontPlayerRef.current = new SoundfontPlayer();
      soundfontPlayerRef.current.init(audioContextRef.current);
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Initialize audio context
  const init = useCallback(async () => {
    if (state.isReady) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setState((prev) => ({ ...prev, isReady: true, error: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize audio',
      }));
    }
  }, [state.isReady]);

  // Load instrument using soundfont-player
  const loadInstrument = useCallback(async (type: InstrumentType) => {
    if (!soundfontPlayerRef.current || !audioContextRef.current) {
      setState((prev) => ({ ...prev, error: 'Audio engine not initialized' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const midiId = INSTRUMENT_TO_MIDI[type];
      currentMidiRef.current = midiId;

      await soundfontPlayerRef.current.load(midiId);
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
  }, []);

  // Play a note using soundfont player
  const playNote = useCallback(async (pitch: string, duration: string) => {
    if (!soundfontPlayerRef.current || !audioContextRef.current) {
      console.warn('Audio engine not ready');
      return;
    }

    // Ensure the instrument is loaded before playing
    const midiId = currentMidiRef.current;
    const isLoaded = soundfontPlayerRef.current.instruments.some(
      i => i.midiId === midiId && i.loaded
    );
    if (!isLoaded) {
      try {
        await soundfontPlayerRef.current.load(midiId);
      } catch (error) {
        console.warn('Failed to load instrument:', error);
        return;
      }
    }

    const frequency = noteToFrequency(pitch);
    // Convert MIDI note number to soundfont player note format
    // frequency = 440 * 2^((note-69)/12), so note = 69 + 12 * log2(frequency/440)
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));

    // Convert duration string to seconds
    const durationSeconds = parseDuration(duration);

    const instructions: NotePlaybackInstruction[] = [
      {
        note: midiNote,
        duration: durationSeconds,
        gain: state.volume,
      },
    ];

    soundfontPlayerRef.current.schedule(
      midiId,
      audioContextRef.current.currentTime,
      instructions
    );
  }, [state.volume]);

  // Set instrument (sync state only, actual loading is done via loadInstrument)
  const setInstrument = useCallback((type: InstrumentType) => {
    saveInstrument(type);
    setState((prev) => ({ ...prev, currentInstrument: type }));
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  }, []);

  // Resume audio context
  const resume = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
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

function parseDuration(duration: string): number {
  const durationMap: Record<string, number> = {
    w: 4,
    h: 2,
    q: 1,
    e: 0.5,
    s: 0.25,
    t: 1 / 3,
    full: 4,
  };
  const base = durationMap[duration] || 0.5;
  return duration.includes('t') ? (base * 2) / 3 : base;
}

export default useAudioEngine;