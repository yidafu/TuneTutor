import type { TranslationSet } from '../locales/en-US'
import type { InstrumentType } from '../types/audio'

/** 乐器展示用 emoji（ui-design.html v3） */
export const INSTRUMENT_EMOJI: Record<InstrumentType, string> = {
  piano: '🎹',
  saxophone: '🎷',
  guitar: '🎸',
  bass: '🎸',
  violin: '🎻',
  flute: '🪈',
  trumpet: '🎺',
}

export function instrumentLabel(t: TranslationSet, instrument: InstrumentType): string {
  switch (instrument) {
    case 'piano':
      return t.instrumentPiano
    case 'saxophone':
      return t.instrumentSaxophone
    case 'guitar':
      return t.instrumentGuitar
    case 'bass':
      return t.instrumentBass
    case 'violin':
      return t.instrumentViolin
    case 'flute':
      return t.instrumentFlute
    case 'trumpet':
      return t.instrumentTrumpet
  }
}
