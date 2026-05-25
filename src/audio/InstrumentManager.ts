import type { Instrument, Voice } from "opensheetmusicdisplay";
import type { PlaybackInstrument } from "./TonejsPlayer";
import { TonejsPlayer } from "./TonejsPlayer";
import { getVoiceMidiInstrumentId, setVoiceMidiInstrumentId } from "../types/osmd-extensions";

export class InstrumentManager {
  private player: TonejsPlayer;
  private voiceMidiMap: Map<number, number> = new Map();

  constructor(player: TonejsPlayer) {
    this.player = player;
  }

  get availableInstruments(): PlaybackInstrument[] {
    return this.player.instruments;
  }

  async loadInstruments(instruments: Instrument[]): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const instrument of instruments) {
      const midiId = instrument.MidiInstrumentId;
      const pbInstrument = this.player.instruments.find(pbi => pbi.midiId === midiId);

      if (!pbInstrument) {
        console.warn(`Can't find playback instrument for midiInstrumentId ${midiId}. Falling back to piano`);
        instrument.MidiInstrumentId = 0;
      }

      promises.push(this.player.load(midiId));
    }

    await Promise.all(promises);
  }

  initInstrumentsForSheet(instruments: Instrument[]): void {
    for (const instrument of instruments) {
      for (const voice of instrument.Voices) {
        setVoiceMidiInstrumentId(voice, instrument.MidiInstrumentId);
        this.voiceMidiMap.set(voice.VoiceId, instrument.MidiInstrumentId);
      }
    }
  }

  stopAll(instruments: Instrument[]): void {
    for (const instrument of instruments) {
      for (const voice of instrument.Voices) {
        const midiId = getVoiceMidiInstrumentId(voice);
        this.player.stop(midiId);
      }
    }
  }

  stopVoice(voice: Voice): void {
    const midiId = getVoiceMidiInstrumentId(voice);
    this.player.stop(midiId);
  }

  getPlaybackInstrumentForVoice(
    voiceId: number,
    sheetInstruments: Instrument[],
    availableInstruments: PlaybackInstrument[]
  ): PlaybackInstrument | null {
    const voice = sheetInstruments.flatMap(i => i.Voices).find(v => v.VoiceId === voiceId);
    if (!voice) return null;

    const midiId = getVoiceMidiInstrumentId(voice);
    return availableInstruments.find(i => i.midiId === midiId) ?? null;
  }

  setVoiceMidiInstrument(voice: Voice, midiInstrumentId: number): void {
    setVoiceMidiInstrumentId(voice, midiInstrumentId);
    this.voiceMidiMap.set(voice.VoiceId, midiInstrumentId);
  }
}
