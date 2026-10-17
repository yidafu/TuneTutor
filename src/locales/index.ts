/**
 * Internationalization utilities
 */
import { enUS } from './en-US';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { frFR } from './fr-FR';
import { isBrowser } from '../utils/isBrowser';

export type Language = 'en-US' | 'zh-CN' | 'zh-TW' | 'fr-FR';

// Common interface for all translation sets
export interface TranslationSet {
  // Header
  appTitle: string;
  loadFile: string;

  // Instruments
  instrument_piano: string;
  instrument_saxophone: string;
  instrument_guitar: string;
  instrument_bass: string;
  instrument_violin: string;
  instrument_flute: string;
  instrument_trumpet: string;

  // PlaybackControls
  tempo: string;
  bpm: string;
  play: string;
  pause: string;
  stop: string;
  loop: string;
  loopSkip: string;
  off: string;
  metronome: string;
  metronomeSound: string;
  metronomeSound_classic: string;
  metronomeSound_digital: string;
  metronomeSound_kick: string;
  metronomeSound_click: string;
  metronomeStrongBeat: string;
  metronomeWeakBeat: string;

  // StatusBar
  noSelection: string;
  selected: string;
  tempoLabel: string;
  instrument: string;
  loopConfigSkip: string;

  // ScoreInfo
  composer: string;

  // SelectionInfo
  clickToSelect: string;
  note: string;
  notes: string;
  clearSelection: string;

  // FileLoaderModal
  loadSheetMusic: string;
  supportedFormats: string;

  // Selection formatting
  measure: string;
  measures: string;

  // Loop modes
  loopPhrase: string;
  phraseSelected: string;

  // Language switcher
  language: string;
  chinese: string;
  english: string;
  french: string;

  // Navigation
  navScore: string;
  navOriginalAudio: string;

  // OriginalAudio page
  originalAudio: string;
  importAudio: string;
  importAudioHint: string;
  removeAudio: string;
  audioDuration: string;
  sliceRange: string;
  sliceDurationLabel: string;
  gapBeats: string;
  dragToSelect: string;
  audioPlayLoop: string;
  audioPlayWhole: string;
  unsupportedAudioFormat: string;
}

export const translations: Record<Language, TranslationSet> = {
  'en-US': enUS as unknown as TranslationSet,
  'zh-CN': zhCN as unknown as TranslationSet,
  'zh-TW': zhTW as unknown as TranslationSet,
  'fr-FR': frFR as unknown as TranslationSet,
};

export const languageNames: Record<Language, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'fr-FR': 'Français',
};

/**
 * Get the default language from browser settings
 */
export function getDefaultLanguage(): Language {
  if (!isBrowser) return 'en-US';

  const saved = localStorage.getItem('note-slice-language') as Language | null;
  if (saved && saved in translations) {
    return saved;
  }

  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    // Distinguish between traditional and simplified Chinese
    if (browserLang.includes('tw') || browserLang.includes('hk') || browserLang.includes('mo')) {
      return 'zh-TW';
    }
    return 'zh-CN';
  }
  if (browserLang.startsWith('fr')) {
    return 'fr-FR';
  }
  return 'en-US';
}

/**
 * Save language preference to localStorage
 */
export function saveLanguage(lang: Language): void {
  if (isBrowser) {
    localStorage.setItem('note-slice-language', lang);
  }
}

