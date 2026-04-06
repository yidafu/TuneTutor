/**
 * Audio engine types for the Music Notation Player
 */

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
export const instrumentNamesEn: Record<string, string> = {
  piano: 'Piano',
  saxophone: 'Saxophone',
  guitar: 'Guitar',
  bass: 'Bass',
  violin: 'Violin',
  flute: 'Flute',
  trumpet: 'Trumpet',
} as const;

// Chinese instrument names
export const instrumentNamesZh: Record<string, string> = {
  piano: '钢琴',
  saxophone: '萨克斯',
  guitar: '吉他',
  bass: '贝斯',
  violin: '小提琴',
  flute: '长笛',
  trumpet: '小号',
} as const;

// Mapping from InstrumentType to MIDI instrument ID
export const INSTRUMENT_TO_MIDI: Record<InstrumentType, number> = {
  piano: 0, // Acoustic Grand Piano
  saxophone: 65, // Alto Sax
  guitar: 25, // Acoustic Guitar (steel) - 使用确定支持的
  bass: 32, // Acoustic Bass
  violin: 40, // Violin
  flute: 73, // Flute
  trumpet: 56, // Trumpet
};

// Get instrument name based on translation set
export function getInstrumentName(type: InstrumentType, t: Record<string, any>): string {
  const inst = INSTRUMENTS.find(i => i.type === type);
  if (!inst) return type;
  const key = `instrument_${inst.nameKey}` as keyof typeof t;
  return (t[key] as string) || instrumentNamesEn[inst.nameKey] || instrumentNamesZh[inst.nameKey] || inst.nameKey;
}
