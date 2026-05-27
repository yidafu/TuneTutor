import { Sampler } from 'tone';
import type { InstrumentType } from '../types/audio';
import InstrumentPianoMp3 from 'tonejs-instrument-piano-mp3';
import InstrumentGuitarAcousticMp3 from 'tonejs-instrument-guitar-acoustic-mp3';
import InstrumentBassElectricMp3 from 'tonejs-instrument-bass-electric-mp3';
import InstrumentViolinMp3 from 'tonejs-instrument-violin-mp3';
import InstrumentFluteMp3 from 'tonejs-instrument-flute-mp3';
import InstrumentSaxophoneMp3 from 'tonejs-instrument-saxophone-mp3';
import InstrumentTrumpetMp3 from 'tonejs-instrument-trumpet-mp3';

type InstrumentConstructor = new (options?: {
  minify?: boolean;
  onload?: () => void;
}) => Sampler;

const INSTRUMENT_CTORS: Record<InstrumentType, InstrumentConstructor> = {
  piano: InstrumentPianoMp3,
  guitar: InstrumentGuitarAcousticMp3,
  bass: InstrumentBassElectricMp3,
  violin: InstrumentViolinMp3,
  flute: InstrumentFluteMp3,
  saxophone: InstrumentSaxophoneMp3,
  trumpet: InstrumentTrumpetMp3,
};

export class InstrumentLoader {
  private samplers = new Map<InstrumentType, Sampler>();

  async loadInstrument(type: InstrumentType): Promise<Sampler> {
    const existing = this.samplers.get(type);
    if (existing) return existing;

    const Ctor = INSTRUMENT_CTORS[type];
    const sampler = await new Promise<Sampler>((resolve) => {
      const instance = new Ctor({ onload: () => resolve(instance) });
    });

    sampler.toDestination();
    this.samplers.set(type, sampler);
    return sampler;
  }

  getSampler(type: InstrumentType): Sampler | null {
    return this.samplers.get(type) ?? null;
  }

  dispose(): void {
    this.samplers.forEach((sampler) => {
      sampler.disconnect();
      sampler.dispose();
    });
    this.samplers.clear();
  }
}
