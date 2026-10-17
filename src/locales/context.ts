import { createContext } from 'react'
import type { TranslationSet } from './en-US'
import type { Language } from './languages'

export interface I18nContextValue {
  /** 当前语言的翻译集 */
  t: TranslationSet
  language: Language
  setLanguage: (language: Language) => void
}

export const I18nContext = createContext<I18nContextValue | null>(null)
