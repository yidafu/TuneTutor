import * as Tone from 'tone';
import InstrumentPianoMp3 from 'tonejs-instrument-piano-mp3';
import InstrumentGuitarAcousticMp3 from 'tonejs-instrument-guitar-acoustic-mp3';
import InstrumentBassElectricMp3 from 'tonejs-instrument-bass-electric-mp3';
import InstrumentViolinMp3 from 'tonejs-instrument-violin-mp3';
import InstrumentFluteMp3 from 'tonejs-instrument-flute-mp3';
import InstrumentSaxophoneMp3 from 'tonejs-instrument-saxophone-mp3';
import InstrumentTrumpetMp3 from 'tonejs-instrument-trumpet-mp3';

export interface PlaybackInstrument {
  midiId: number;
  name: string;
  loaded: boolean;
}

export interface NotePlaybackInstruction {
  note: number;
  duration: number;
  gain: number;
  articulation?: ArticulationStyle;
}

export const ArticulationStyle = {
  Normal: "normal",
  Staccato: "staccato",
  Accent: "accent",
  Tenuto: "tenuto",
} as const;

export type ArticulationStyle = typeof ArticulationStyle[keyof typeof ArticulationStyle];

export const midiInstruments: [number, string][] = [
  [0, "Acoustic Grand Piano"],
  [1, "Bright Acoustic Piano"],
  [2, "Electric Grand Piano"],
  [3, "Honky-tonk Piano"],
  [4, "Electric Piano 1"],
  [5, "Electric Piano 2"],
  [6, "Harpsichord"],
  [7, "Clavi"],
  [8, "Celesta"],
  [9, "Glockenspiel"],
  [10, "Music Box"],
  [11, "Vibraphone"],
  [12, "Marimba"],
  [13, "Xylophone"],
  [14, "Tubular Bells"],
  [15, "Dulcimer"],
  [16, "Drawbar Organ"],
  [17, "Percussive Organ"],
  [18, "Rock Organ"],
  [19, "Church Organ"],
  [20, "Reed Organ"],
  [21, "Accordion"],
  [22, "Harmonica"],
  [23, "Tango Accordion"],
  [24, "Acoustic Guitar (nylon)"],
  [25, "Acoustic Guitar (steel)"],
  [26, "Electric Guitar (jazz)"],
  [27, "Electric Guitar (clean)"],
  [28, "Electric Guitar (muted)"],
  [29, "Overdriven Guitar"],
  [30, "Distortion Guitar"],
  [31, "Guitar harmonics"],
  [32, "Acoustic Bass"],
  [33, "Electric Bass (finger)"],
  [34, "Electric Bass (pick)"],
  [35, "Fretless Bass"],
  [36, "Slap Bass 1"],
  [37, "Slap Bass 2"],
  [38, "Synth Bass 1"],
  [39, "Synth Bass 2"],
  [40, "Violin"],
  [41, "Viola"],
  [42, "Cello"],
  [43, "Contrabass"],
  [44, "Tremolo Strings"],
  [45, "Pizzicato Strings"],
  [46, "Orchestral Harp"],
  [47, "Timpani"],
  [48, "String Ensemble 1"],
  [49, "String Ensemble 2"],
  [50, "SynthStrings 1"],
  [51, "SynthStrings 2"],
  [52, "Choir Aahs"],
  [53, "Voice Oohs"],
  [54, "Synth Choir"],
  [55, "Orchestra Hit"],
  [56, "Trumpet"],
  [57, "Trombone"],
  [58, "Tuba"],
  [59, "Muted Trumpet"],
  [60, "French Horn"],
  [61, "Brass Section"],
  [62, "SynthBrass 1"],
  [63, "SynthBrass 2"],
  [64, "Soprano Sax"],
  [65, "Alto Sax"],
  [66, "Tenor Sax"],
  [67, "Baritone Sax"],
  [68, "Oboe"],
  [69, "English Horn"],
  [70, "Bassoon"],
  [71, "Clarinet"],
  [72, "Piccolo"],
  [73, "Flute"],
  [74, "Recorder"],
  [75, "Pan Flute"],
  [76, "Blown Bottle"],
  [77, "Shakuhachi"],
  [78, "Whistle"],
  [79, "Ocarina"],
  [80, "Lead 1 (square)"],
  [81, "Lead 2 (sawtooth)"],
  [82, "Lead 3 (calliope)"],
  [83, "Lead 4 (chiff)"],
  [84, "Lead 5 (charang)"],
  [85, "Lead 6 (voice)"],
  [86, "Lead 7 (fifths)"],
  [87, "Lead 8 (bass + lead)"],
  [88, "Pad 1 (new age)"],
  [89, "Pad 2 (warm)"],
  [90, "Pad 3 (polysynth)"],
  [91, "Pad 4 (choir)"],
  [92, "Pad 5 (bowed)"],
  [93, "Pad 6 (metallic)"],
  [94, "Pad 7 (halo)"],
  [95, "Pad 8 (sweep)"],
  [96, "FX 1 (rain)"],
  [97, "FX 2 (soundtrack)"],
  [98, "FX 3 (crystal)"],
  [99, "FX 4 (atmosphere)"],
  [100, "FX 5 (brightness)"],
  [101, "FX 6 (goblins)"],
  [102, "FX 7 (echoes)"],
  [103, "FX 8 (sci-fi)"],
  [104, "Sitar"],
  [105, "Banjo"],
  [106, "Shamisen"],
  [107, "Koto"],
  [108, "Kalimba"],
  [109, "Bag pipe"],
  [110, "Fiddle"],
  [111, "Shanai"],
  [112, "Tinkle Bell"],
  [113, "Agogo"],
  [114, "Steel Drums"],
  [115, "Woodblock"],
  [116, "Taiko Drum"],
  [117, "Melodic Tom"],
  [118, "Synth Drum"],
  [119, "Reverse Cymbal"],
  [120, "Guitar Fret Noise"],
  [121, "Breath Noise"],
  [122, "Seashore"],
  [123, "Bird Tweet"],
  [124, "Telephone Ring"],
  [125, "Helicopter"],
  [126, "Applause"],
  [127, "Gunshot"],
];

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
