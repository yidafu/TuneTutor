import * as Soundfont from "soundfont-player";
import type { IAudioContext } from "standardized-audio-context";

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

// MIDI instruments list
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

// 已下载到本地的 soundfont 文件列表
const availableSoundfonts = [
  "accordion",
  "acoustic_bass",
  "acoustic_grand_piano",
  "acoustic_guitar_nylon",
  "acoustic_guitar_steel",
  "agogo",
  "alto_sax",
  "applause",
  "bagpipe",
  "banjo",
  "baritone_sax",
  "bassoon",
  "bird_tweet",
];

// Instruments supported by soundfont-player
const supportedInstruments = [
  "accordion",
  "acoustic_bass",
  "acoustic_grand_piano",
  "acoustic_guitar_nylon",
  "acoustic_guitar_steel",
  "agogo",
  "alto_sax",
  "applause",
  "bagpipe",
  "banjo",
  "baritone_sax",
  "bassoon",
  "bird_tweet",
  "blown_bottle",
  "brass_section",
  "breath_noise",
  "bright_acoustic_piano",
  "celesta",
  "cello",
  "choir_aahs",
  "church_organ",
  "clarinet",
  "clavinet",
  "contrabass",
  "distortion_guitar",
  "drawbar_organ",
  "dulcimer",
  "electric_bass_finger",
  "electric_bass_pick",
  "electric_grand_piano",
  "electric_guitar_clean",
  "electric_guitar_jazz",
  "electric_guitar_muted",
  "electric_piano_1",
  "electric_piano_2",
  "english_horn",
  "fiddle",
  "flute",
  "french_horn",
  "fretless_bass",
  "fx_1_rain",
  "fx_2_soundtrack",
  "fx_3_crystal",
  "fx_4_atmosphere",
  "fx_5_brightness",
  "fx_6_goblins",
  "fx_7_echoes",
  "fx_8_scifi",
  "glockenspiel",
  "guitar_fret_noise",
  "guitar_harmonics",
  "gunshot",
  "harmonica",
  "harpsichord",
  "helicopter",
  "honkytonk_piano",
  "kalimba",
  "koto",
  "lead_1_square",
  "lead_2_sawtooth",
  "lead_3_calliope",
  "lead_4_chiff",
  "lead_5_charang",
  "lead_6_voice",
  "lead_7_fifths",
  "lead_8_bass__lead",
  "marimba",
  "melodic_tom",
  "music_box",
  "muted_trumpet",
  "oboe",
  "ocarina",
  "orchestra_hit",
  "orchestral_harp",
  "overdriven_guitar",
  "pad_1_new_age",
  "pad_2_warm",
  "pad_3_polysynth",
  "pad_4_choir",
  "pad_5_bowed",
  "pad_6_metallic",
  "pad_7_halo",
  "pad_8_sweep",
  "pan_flute",
  "percussive_organ",
  "piccolo",
  "pizzicato_strings",
  "recorder",
  "reed_organ",
  "reverse_cymbal",
  "rock_organ",
  "seashore",
  "shakuhachi",
  "shamisen",
  "shanai",
  "sitar",
  "slap_bass_1",
  "slap_bass_2",
  "soprano_sax",
  "steel_drums",
  "string_ensemble_1",
  "string_ensemble_2",
  "synth_bass_1",
  "synth_bass_2",
  "synth_brass_1",
  "synth_brass_2",
  "synth_choir",
  "synth_drum",
  "synth_strings_1",
  "synth_strings_2",
  "taiko_drum",
  "tango_accordion",
  "telephone_ring",
  "tenor_sax",
  "timpani",
  "tinkle_bell",
  "tremolo_strings",
  "trombone",
  "trumpet",
  "tuba",
  "tubular_bells",
  "vibraphone",
  "viola",
  "violin",
  "voice_oohs",
  "whistle",
  "woodblock",
  "xylophone",
];

export class SoundfontPlayer {
  public instruments: PlaybackInstrument[];

  private players: Map<number, Soundfont.Player> = new Map();
  private audioContext!: IAudioContext;

  constructor() {
    this.instruments = midiInstruments
      .filter(i => supportedInstruments.includes(this.getSoundfontInstrumentName(i[1])))
      .map(i => ({
        midiId: i[0],
        name: i[1],
        loaded: false,
      }));
  }

  init(audioContext: IAudioContext) {
    this.audioContext = audioContext;
  }

  async load(midiId: number) {
    const instrument = this.instruments.find(i => i.midiId === midiId);
    if (!instrument) {
      throw new Error("SoundfontPlayer does not support midi instrument ID " + midiId);
    }
    if (this.players.has(midiId)) return;

    const sfName = this.getSoundfontInstrumentName(instrument.name);

    // 应用运行在 /TuneTutor/ 子目录下
    const BASE_PATH = '/TuneTutor/';

    // 优先使用本地文件，如果本地没有则回退到远程
    const isLocalAvailable = availableSoundfonts.includes(sfName);
    const nameToUrl = isLocalAvailable
      ? (name: string) => `${BASE_PATH}soundfonts/${name}-mp3.js`
      : (name: string) => `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${name}-mp3.js`;

    const player = await Soundfont.instrument(
      this.audioContext as unknown as Parameters<typeof Soundfont.instrument>[0],
      sfName as Soundfont.InstrumentName,
      { nameToUrl }
    );
    this.players.set(midiId, player);
    instrument.loaded = true;
  }

  stop(midiId: number) {
    const player = this.players.get(midiId);
    if (!player) return;
    player.stop();
  }

  schedule(midiId: number, time: number, notes: NotePlaybackInstruction[]) {
    this.verifyPlayerLoaded(midiId);
    const processedNotes = this.applyDynamics(notes);
    this.players.get(midiId)!.schedule(time, processedNotes);
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

  private verifyPlayerLoaded(midiId: number) {
    if (!this.players.has(midiId)) {
      throw new Error("No soundfont player loaded for midi instrument " + midiId);
    }
  }

  private getSoundfontInstrumentName(midiName: string): string {
    return midiName.toLowerCase().replace(/\s+/g, "_");
  }
}