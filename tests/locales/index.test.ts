import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultLanguage,
  saveLanguage,
  createTranslate,
  formatString,
  translations,
  languageNames,
  type Language,
} from '@/locales/index';

describe('locales', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDefaultLanguage', () => {
    it('should return en-US when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR case
      delete global.window;
      expect(getDefaultLanguage()).toBe('en-US');
      global.window = originalWindow;
    });

    it('should return saved language from localStorage if valid', () => {
      localStorage.setItem('note-slice-language', 'zh-CN');
      expect(getDefaultLanguage()).toBe('zh-CN');
    });

    it('should return en-US if saved language is invalid', () => {
      localStorage.setItem('note-slice-language', 'invalid-lang');
      expect(getDefaultLanguage()).toBe('en-US');
    });

    it('should return zh-CN for Chinese browser language (simplified)', () => {
      Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
      expect(getDefaultLanguage()).toBe('zh-CN');
    });

    it('should return zh-TW for traditional Chinese browser language', () => {
      Object.defineProperty(navigator, 'language', { value: 'zh-TW', configurable: true });
      expect(getDefaultLanguage()).toBe('zh-TW');
    });

    it('should return fr-FR for French browser language', () => {
      Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
      expect(getDefaultLanguage()).toBe('fr-FR');
    });

    it('should return en-US for English browser language', () => {
      Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
      expect(getDefaultLanguage()).toBe('en-US');
    });

    it('should return zh-TW for zh-HK browser language (Hong Kong)', () => {
      Object.defineProperty(navigator, 'language', { value: 'zh-HK', configurable: true });
      expect(getDefaultLanguage()).toBe('zh-TW');
    });
  });

  describe('saveLanguage', () => {
    it('should save language to localStorage', () => {
      saveLanguage('fr-FR');
      expect(localStorage.getItem('note-slice-language')).toBe('fr-FR');
    });

    it('should not throw when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR case
      delete global.window;
      expect(() => saveLanguage('zh-TW')).not.toThrow();
      global.window = originalWindow;
    });
  });

  describe('createTranslate', () => {
    it('should return correct translation set for en-US', () => {
      const t = createTranslate('en-US');
      expect(t.appTitle).toBe('Tune Tutor');
      expect(t.play).toBe('Play');
    });

    it('should return correct translation set for zh-CN', () => {
      const t = createTranslate('zh-CN');
      expect(t.appTitle).toBe('乐谱播放器');
      expect(t.play).toBe('播放');
    });

    it('should return correct translation set for zh-TW', () => {
      const t = createTranslate('zh-TW');
      expect(t.appTitle).toBe('樂譜播放器');
      expect(t.play).toBe('播放');
    });

    it('should return correct translation set for fr-FR', () => {
      const t = createTranslate('fr-FR');
      expect(t.appTitle).toBe('Tune Tutor');
      expect(t.play).toBe('Jouer');
    });
  });

  describe('formatString', () => {
    it('should replace {0} placeholder with first argument', () => {
      expect(formatString('Hello {0}', 'World')).toBe('Hello World');
    });

    it('should replace multiple placeholders', () => {
      expect(formatString('Measures {0}-{1}', '1', '10')).toBe('Measures 1-10');
    });

    it('should replace no placeholders when no args provided', () => {
      expect(formatString('No placeholders')).toBe('No placeholders');
    });

    it('should handle empty string', () => {
      expect(formatString('', 'arg')).toBe('');
    });

    it('should replace Skip label with format', () => {
      expect(formatString('Skip: {0}', '3')).toBe('Skip: 3');
    });
  });

  describe('translations', () => {
    it('should have all 4 languages', () => {
      expect(Object.keys(translations)).toEqual(['en-US', 'zh-CN', 'zh-TW', 'fr-FR']);
    });

    it('each language should have all required translation keys', () => {
      const requiredKeys = [
        'appTitle',
        'loadFile',
        'instrument_piano',
        'tempo',
        'bpm',
        'play',
        'pause',
        'stop',
        'noSelection',
        'selected',
        'measure',
        'measures',
        'language',
      ];

      for (const lang of Object.keys(translations) as Language[]) {
        const t = translations[lang];
        for (const key of requiredKeys) {
          expect(t).toHaveProperty(key);
        }
      }
    });
  });

  describe('languageNames', () => {
    it('should have human-readable names for all languages', () => {
      expect(languageNames['en-US']).toBe('English');
      expect(languageNames['zh-CN']).toBe('简体中文');
      expect(languageNames['zh-TW']).toBe('繁體中文');
      expect(languageNames['fr-FR']).toBe('Français');
    });
  });
});
