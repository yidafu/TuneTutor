/**
 * Audio engine types for the Music Notation Player
 */

import type { TranslationSet } from '../locales';
import { isBrowser } from '../utils/isBrowser';

export type InstrumentType = 'piano' | 'saxophone' | 'guitar' | 'bass' | 'violin' | 'flute' | 'trumpet';

export interface InstrumentConfig {
  type: InstrumentType;
  nameKey: string;
  icon: string;
  category: 'keyboard' | 'woodwind' | 'brass' | 'string' | 'pluck';
}

export const INSTRUMENTS: InstrumentConfig[] = [
  { type: 'piano', nameKey: 'piano', icon: '🎹', category: 'keyboard' },
  { type: 'saxophone', nameKey: 'saxophone', icon: '🎷', category: 'woodwind' },
  { type: 'guitar', nameKey: 'guitar', icon: '🎸', category: 'pluck' },
  { type: 'bass', nameKey: 'bass', icon: '🎸', category: 'pluck' },
  { type: 'violin', nameKey: 'violin', icon: '🎻', category: 'string' },
  { type: 'flute', nameKey: 'flute', icon: '🎼', category: 'woodwind' },
  { type: 'trumpet', nameKey: 'trumpet', icon: '🎺', category: 'brass' },
] as const;

// English instrument names (fallback)
export const instrumentNamesEn: Record<InstrumentType, string> = {
  piano: 'Piano',
  saxophone: 'Saxophone',
  guitar: 'Guitar',
  bass: 'Bass',
  violin: 'Violin',
  flute: 'Flute',
  trumpet: 'Trumpet',
} as const;

// Chinese instrument names
export const instrumentNamesZh: Record<InstrumentType, string> = {
  piano: '钢琴',
  saxophone: '萨克斯',
  guitar: '吉他',
  bass: '贝斯',
  violin: '小提琴',
  flute: '长笛',
  trumpet: '小号',
} as const;

// Instrument persistence in localStorage
const STORAGE_KEY = 'note-slice-preferred-instrument';

export function getSavedInstrument(): InstrumentType {
  if (!isBrowser) return 'piano';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && INSTRUMENTS.some(i => i.type === saved)) {
    return saved as InstrumentType;
  }
  return 'piano';
}

export function saveInstrument(type: InstrumentType): void {
  if (isBrowser) {
    localStorage.setItem(STORAGE_KEY, type);
  }
}

// Get instrument name based on translation set
export function getInstrumentName(type: InstrumentType, t: TranslationSet): string {
  const inst = INSTRUMENTS.find(i => i.type === type);
  if (!inst) return type;
  const key = `instrument_${inst.nameKey}` as keyof TranslationSet;
  return t[key] || instrumentNamesEn[type] || instrumentNamesZh[type] || inst.nameKey;
}

/**
 * A time range (seconds) of the imported original audio selected for slice-loop playback.
 */
export interface AudioSlice {
  startTime: number;
  endTime: number;
}
