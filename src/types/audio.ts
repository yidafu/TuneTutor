/** 乐器音色（docs/tech.md §3，7 种 tonejs-instrument 采样，钢琴默认） */
export type InstrumentType = 'piano' | 'saxophone' | 'guitar' | 'bass' | 'violin' | 'flute' | 'trumpet'

export const INSTRUMENT_TYPES: readonly InstrumentType[] = [
  'piano',
  'saxophone',
  'guitar',
  'bass',
  'violin',
  'flute',
  'trumpet',
]

/** 节拍器音色（docs/tech.md §3） */
export type MetronomeSoundType = 'classic' | 'digital' | 'kick' | 'click'

export const METRONOME_SOUND_TYPES: readonly MetronomeSoundType[] = [
  'classic',
  'digital',
  'kick',
  'click',
]
