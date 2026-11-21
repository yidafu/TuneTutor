import type { TranslationSet } from '../locales/en-US'
import type { InstrumentType } from '../types/audio'

/** 乐器展示标签；字形由 components/icons 的 InstrumentGlyph 提供（SVG，随主题） */
export function instrumentLabel(t: TranslationSet, instrument: InstrumentType): string {
  switch (instrument) {
    case 'piano':
      return t.instrumentPiano
    case 'saxophone':
      return t.instrumentSaxophone
    case 'clarinet':
      return t.instrumentClarinet
    case 'flute':
      return t.instrumentFlute
    case 'trumpet':
      return t.instrumentTrumpet
    case 'frenchHorn':
      return t.instrumentFrenchHorn
    case 'trombone':
      return t.instrumentTrombone
    case 'violin':
      return t.instrumentViolin
    case 'cello':
      return t.instrumentCello
    case 'guitar':
      return t.instrumentGuitar
    case 'guitarNylon':
      return t.instrumentGuitarNylon
    case 'bass':
      return t.instrumentBass
  }
}
