import type { TranslationSet } from '../locales/en-US'
import type { InstrumentType } from '../types/audio'

/** 乐器展示标签；字形由 components/icons 的 InstrumentGlyph 提供（SVG，随主题） */
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
