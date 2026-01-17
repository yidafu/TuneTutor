/**
 * i18n Context - React Context for translations
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type Context } from 'react';
import { getDefaultLanguage, saveLanguage, type Language, type TranslationSet, translations } from './index';

export type { Language } from './index';

// Create context
interface I18nContextType {
  language: Language;
  t: TranslationSet;
  setLanguage: (lang: Language) => void;
}

export const I18nContext: Context<I18nContextType | undefined> = createContext<I18nContextType | undefined>(undefined);

// Provider props
interface I18nProviderProps {
  children: ReactNode;
}

// Hook to use translation context
export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

// Provider component
export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(getDefaultLanguage);
  const [t, setT] = useState<TranslationSet>(translations[getDefaultLanguage()] as TranslationSet);

  useEffect(() => {
    const savedLang = getDefaultLanguage();
    setLanguageState(savedLang);
    setT(translations[savedLang] as TranslationSet);
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    setT(translations[newLang] as TranslationSet);
    saveLanguage(newLang);
  }, []);

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

// Helper hook to get just the translation function (convenience)
export function useT(): TranslationSet {
  return useTranslation().t;
}

// Helper hook to get just the language
export function useLanguage(): Language {
  return useTranslation().language;
}

// Helper hook to change language
export function useSetLanguage(): (lang: Language) => void {
  return useTranslation().setLanguage;
}
