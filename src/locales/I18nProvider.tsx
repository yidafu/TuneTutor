import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { enUS, type TranslationSet } from './en-US'
import { frFR } from './fr-FR'
import { I18nContext } from './context'
import { LANGUAGE_STORAGE_KEY, resolveLanguage, type Language } from './languages'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'

const TRANSLATIONS: Record<Language, TranslationSet> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'fr-FR': frFR,
}

function detectInitialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const candidates = navigator.languages.length > 0 ? navigator.languages : [navigator.language]
    return resolveLanguage(stored, candidates)
  } catch {
    return 'en-US'
  }
}

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // 无痕模式等场景下 localStorage 不可写，切换仅对当前会话生效
    }
  }, [])

  const value = useMemo(
    () => ({ t: TRANSLATIONS[language], language, setLanguage }),
    [language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
