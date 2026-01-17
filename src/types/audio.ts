/**
 * Audio engine types for the Music Notation Player
 */

export type InstrumentType = 'piano' | 'saxophone' | 'guitar' | 'bass' | 'violin' | 'flute' | 'trumpet';

export interface InstrumentConfig {
  type: InstrumentType;
  name: string;
  icon: string;
  category: 'keyboard' | 'woodwind' | 'brass' | 'string' | 'pluck';
}

export const INSTRUMENTS: InstrumentConfig[] = [
  { type: 'piano', name: 'Piano', icon: '🎹', category: 'keyboard' },
  { type: 'saxophone', name: 'Saxophone', icon: '🎷', category: 'woodwind' },
  { type: 'guitar', name: 'Guitar', icon: '🎸', category: 'pluck' },
  { type: 'bass', name: 'Bass', icon: '🎸', category: 'pluck' },
  { type: 'violin', name: 'Violin', icon: '🎻', category: 'string' },
  { type: 'flute', name: 'Flute', icon: '🎼', category: 'woodwind' },
  { type: 'trumpet', name: 'Trumpet', icon: '🎺', category: 'brass' },
] as const;
