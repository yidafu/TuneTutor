/**
 * Internationalization utilities
 */
import { enUS } from './en-US';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { frFR } from './fr-FR';

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
  loopSkip: string;
  off: string;

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

  // Language switcher
  language: string;
  chinese: string;
  english: string;
  french: string;
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
  if (typeof window === 'undefined') return 'en-US';

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
  if (typeof window !== 'undefined') {
    localStorage.setItem('note-slice-language', lang);
  }
}

/**
 * Create a translate function for the given language
 */
export function createTranslate(lang: Language): TranslationSet {
  return translations[lang];
}

/**
 * Format a translation string with arguments
 */
export function formatString(str: string, ...args: string[]): string {
  return args.reduce((result, arg, index) => {
    return result.replace(`{${index}}`, arg);
  }, str);
}
