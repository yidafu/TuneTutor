/**
 * Instrument Factory - Create and manage audio instruments
 * Uses tonejs-instrument packages for high-quality samples
 */

import * as Tone from 'tone';
import type { InstrumentType } from '../../types/audio';
import { durationToTone } from './NoteMapper';

// Import tonejs-instrument packages
// @ts-ignore
import InstrumentPianoMp3 from 'tonejs-instrument-piano-mp3';
// @ts-ignore
import InstrumentSaxophoneMp3 from 'tonejs-instrument-saxophone-mp3';
// @ts-ignore
import InstrumentViolinMp3 from 'tonejs-instrument-violin-mp3';
// @ts-ignore
import InstrumentFluteMp3 from 'tonejs-instrument-flute-mp3';
// @ts-ignore
import InstrumentTrumpetMp3 from 'tonejs-instrument-trumpet-mp3';
// @ts-ignore
import InstrumentGuitarMp3 from 'tonejs-instrument-guitar-acoustic-mp3';
// @ts-ignore
import InstrumentBassMp3 from 'tonejs-instrument-bass-electric-mp3';

export interface InstrumentState {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

// Map instrument types to their corresponding classes
const INSTRUMENT_CLASSES: Record<string, new (options?: { onload?: () => void }) => Tone.Sampler> = {
  piano: InstrumentPianoMp3,
  saxophone: InstrumentSaxophoneMp3,
  violin: InstrumentViolinMp3,
  flute: InstrumentFluteMp3,
  trumpet: InstrumentTrumpetMp3,
  guitar: InstrumentGuitarMp3,
  bass: InstrumentBassMp3,
};

export class InstrumentFactory {
  private instruments: Map<InstrumentType, Tone.Sampler> = new Map();
  private currentInstrument: InstrumentType = 'piano';
  private state: InstrumentState = {
    isLoading: false,
    isLoaded: false,
    error: null,
  };

  /**
   * Get the current instrument state
   */
  getState(): InstrumentState {
    return { ...this.state };
  }

  /**
   * Get the current instrument type
   */
  getCurrentInstrument(): InstrumentType {
    return this.currentInstrument;
  }

  /**
   * Check if an instrument class is available
   */
  isInstrumentAvailable(type: InstrumentType): boolean {
    return type in INSTRUMENT_CLASSES;
  }

  /**
   * Get list of available instruments
   */
  getAvailableInstruments(): InstrumentType[] {
    return Object.keys(INSTRUMENT_CLASSES) as InstrumentType[];
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async init(): Promise<void> {
    await Tone.start();
  }

  /**
   * Load an instrument's samples
   */
  async loadInstrument(type: InstrumentType): Promise<void> {
    this.state.isLoading = true;
    this.state.error = null;

    const InstrumentClass = INSTRUMENT_CLASSES[type];
    if (!InstrumentClass) {
      this.state.error = `Instrument ${type} is not available`;
      this.state.isLoading = false;
      return;
    }

    try {
      // Create the sampler with the instrument class
      const sampler = new InstrumentClass({
        onload: () => {
          this.state.isLoading = false;
          this.state.isLoaded = true;
        },
      }).toDestination();

      this.instruments.set(type, sampler);
      this.currentInstrument = type;
      this.state.isLoaded = true;
    } catch (error) {
      console.error(`Error creating ${type} instrument:`, error);
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Play a note
   */
  playNote(pitch: string, duration: string, time?: number): void {
    const sampler = this.instruments.get(this.currentInstrument);
    if (!sampler) {
      console.warn('Instrument not loaded');
      return;
    }

    // Convert pitch to Tone.js format
    const tonePitch = pitch
      .replace('♯', '#')
      .replace('♭', 'b');

    // Convert duration to Tone.js format
    const toneDuration = durationToTone(duration);

    // Calculate trigger time
    const triggerTime = time !== undefined ? time : Tone.now();

    try {
      sampler.triggerAttackRelease(tonePitch, toneDuration, triggerTime);
    } catch (error) {
      console.error(`Error playing note ${pitch}:`, error);
    }
  }

  /**
   * Play a note (attack only)
   */
  triggerAttack(pitch: string): void {
    const sampler = this.instruments.get(this.currentInstrument);
    if (!sampler) return;

    const tonePitch = pitch.replace('♯', '#').replace('♭', 'b');
    sampler.triggerAttack(tonePitch);
  }

  /**
   * Stop a note (release)
   */
  triggerRelease(pitch: string): void {
    const sampler = this.instruments.get(this.currentInstrument);
    if (!sampler) return;

    const tonePitch = pitch.replace('♯', '#').replace('♭', 'b');
    sampler.triggerRelease(tonePitch);
  }

  /**
   * Set the current instrument
   */
  setInstrument(type: InstrumentType): void {
    if (type in INSTRUMENT_CLASSES) {
      this.currentInstrument = type;
    } else {
      console.warn(`Instrument ${type} is not available`);
    }
  }

  /**
   * Set master volume
   */
  setVolume(db: number): void {
    Tone.Destination.volume.value = db;
  }

  /**
   * Dispose of all instruments
   */
  dispose(): void {
    this.instruments.forEach((sampler) => {
      sampler.dispose();
    });
    this.instruments.clear();
    this.state = {
      isLoading: false,
      isLoaded: false,
      error: null,
    };
  }
}

// Singleton instance
let instrumentFactory: InstrumentFactory | null = null;

export function getInstrumentFactory(): InstrumentFactory {
  if (!instrumentFactory) {
    instrumentFactory = new InstrumentFactory();
  }
  return instrumentFactory;
}

export default InstrumentFactory;
