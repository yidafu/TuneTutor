import type { Voice, VoiceEntry } from "opensheetmusicdisplay";

export interface PlaybackVoice extends Voice {
  midiInstrumentId: number;
}

export function getVoiceMidiInstrumentId(voice: Voice): number {
  return (voice as unknown as PlaybackVoice).midiInstrumentId;
}

export function setVoiceMidiInstrumentId(voice: Voice, midiId: number): void {
  (voice as unknown as PlaybackVoice).midiInstrumentId = midiId;
}

export function getVoiceEntryMidiInstrumentId(entry: VoiceEntry): number | undefined {
  const voice = entry.ParentVoice;
  if (!voice) return undefined;
  return (voice as unknown as PlaybackVoice).midiInstrumentId;
}
