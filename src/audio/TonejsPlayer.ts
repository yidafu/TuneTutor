import * as Tone from 'tone';
import InstrumentPianoMp3 from 'tonejs-instrument-piano-mp3';
import InstrumentGuitarAcousticMp3 from 'tonejs-instrument-guitar-acoustic-mp3';
import InstrumentBassElectricMp3 from 'tonejs-instrument-bass-electric-mp3';
import InstrumentViolinMp3 from 'tonejs-instrument-violin-mp3';
import InstrumentFluteMp3 from 'tonejs-instrument-flute-mp3';
import InstrumentSaxophoneMp3 from 'tonejs-instrument-saxophone-mp3';
import InstrumentTrumpetMp3 from 'tonejs-instrument-trumpet-mp3';
import type { PlaybackInstrument } from './SoundfontPlayer';
import { ArticulationStyle, midiInstruments } from './SoundfontPlayer';

export interface NotePlaybackInstruction {
  note: number;
  duration: number;
  gain: number;
  articulation?: ArticulationStyle;
}

const INSTRUMENT_CLASSES: Record<number, typeof InstrumentPianoMp3> = {
  0: InstrumentPianoMp3,
  25: InstrumentGuitarAcousticMp3,
  32: InstrumentBassElectricMp3,
  40: InstrumentViolinMp3,
  56: InstrumentTrumpetMp3,
  65: InstrumentSaxophoneMp3,
  73: InstrumentFluteMp3,
};

export class TonejsPlayer {
  public instruments: PlaybackInstrument[];

  private samplers: Map<number, Tone.Sampler> = new Map();
  private fallbackSynths: Map<number, Tone.PolySynth> = new Map();
  private isInitialized = false;

  constructor() {
    this.instruments = midiInstruments
      .filter(i => this.isSupportedMidiId(i[0]))
      .map(i => ({
        midiId: i[0],
        name: i[1],
        loaded: false,
      }));
  }

  init() {
    // Tone.js manages its own audio context
  }

  private isSupportedMidiId(midiId: number): boolean {
    return midiId in INSTRUMENT_CLASSES;
  }

  async load(midiId: number): Promise<void> {
    const instrument = this.instruments.find(i => i.midiId === midiId);
    if (!instrument) {
      throw new Error(`TonejsPlayer does not support MIDI instrument ID ${midiId}`);
    }

    if (this.samplers.has(midiId) || this.fallbackSynths.has(midiId)) {
      return;
    }

    if (!this.isInitialized) {
      await Tone.start();
      this.isInitialized = true;
    }

    if (midiId in INSTRUMENT_CLASSES) {
      const SamplerClass = INSTRUMENT_CLASSES[midiId];
      const sampler = new SamplerClass({
        onload: () => {
          instrument.loaded = true;
        }
      });
      sampler.toDestination();
      this.samplers.set(midiId, sampler);
    } else {
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      synth.volume.value = -10;
      this.fallbackSynths.set(midiId, synth);
      instrument.loaded = true;
    }
  }

  stop(midiId: number) {
    const sampler = this.samplers.get(midiId);
    if (sampler) {
      sampler.releaseAll();
    }
    const synth = this.fallbackSynths.get(midiId);
    if (synth) {
      synth.releaseAll();
    }
  }

  schedule(midiId: number, time: number, notes: NotePlaybackInstruction[]) {
    const sampler = this.samplers.get(midiId);
    const synth = this.fallbackSynths.get(midiId);
    const player = sampler || synth;

    if (!player) {
      throw new Error(`No player loaded for MIDI instrument ${midiId}`);
    }

    const processedNotes = this.applyDynamics(notes);

    for (const note of processedNotes) {
      const noteName = this.midiToNoteName(note.note);
      const duration = note.duration;

      if (sampler) {
        sampler.triggerAttackRelease(noteName, duration, time, note.gain);
      } else if (synth) {
        synth.triggerAttackRelease(noteName, duration, time, note.gain);
      }
    }
  }

  private applyDynamics(notes: NotePlaybackInstruction[]): NotePlaybackInstruction[] {
    return notes.map(note => {
      if (note.articulation === ArticulationStyle.Staccato) {
        return {
          ...note,
          gain: Math.max(note.gain + 0.3, note.gain * 1.3),
          duration: Math.min(note.duration * 0.4, 0.4),
        };
      }
      return note;
    });
  }

  private midiToNoteName(midi: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${noteNames[noteIndex]}${octave}`;
  }
}
