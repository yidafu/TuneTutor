/**
 * 乐器音色（docs/tech.md §3，12 种 tonejs-instrument 采样，钢琴默认）。
 * key 持久化在 localStorage（note-slice-preferred-instrument），只增不改：
 * `guitar` 恒指钢弦民谣吉他，尼龙弦古典吉他另立 `guitarNylon`。
 */
export type InstrumentType =
  | 'piano'
  | 'saxophone'
  | 'clarinet'
  | 'flute'
  | 'trumpet'
  | 'frenchHorn'
  | 'trombone'
  | 'violin'
  | 'cello'
  | 'guitar'
  | 'guitarNylon'
  | 'bass'

/** 选择器展示顺序：钢琴 → 木管 → 铜管 → 弓弦 → 拨弦 */
export const INSTRUMENT_TYPES: readonly InstrumentType[] = [
  'piano',
  'saxophone',
  'clarinet',
  'flute',
  'trumpet',
  'frenchHorn',
  'trombone',
  'violin',
  'cello',
  'guitar',
  'guitarNylon',
  'bass',
]

/** 节拍器音色（docs/tech.md §3） */
export type MetronomeSoundType = 'classic' | 'digital' | 'kick' | 'click'

export const METRONOME_SOUND_TYPES: readonly MetronomeSoundType[] = [
  'classic',
  'digital',
  'kick',
  'click',
]
