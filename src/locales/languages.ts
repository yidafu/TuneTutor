/** 支持的语言（docs/tech.md §8：四语言，key 结构完全一致） */
export const LANGUAGES = ['en-US', 'zh-CN', 'zh-TW', 'fr-FR'] as const

export type Language = (typeof LANGUAGES)[number]

/** localStorage 键（docs/tech.md §7.2） */
export const LANGUAGE_STORAGE_KEY = 'note-slice-language'

/** 语言自称（切换菜单展示用，不随语言翻译） */
export const LANGUAGE_NAMES: Record<Language, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'fr-FR': 'Français',
}

/**
 * 语言解析（docs/tech.md §8）：
 * localStorage 存储值 → 浏览器语言（按候选顺序）→ 默认 en-US。
 */
export function resolveLanguage(stored: string | null, candidates: readonly string[]): Language {
  if (stored !== null && (LANGUAGES as readonly string[]).includes(stored)) {
    return stored as Language
  }
  for (const candidate of candidates) {
    const exact = LANGUAGES.find((language) => language.toLowerCase() === candidate.toLowerCase())
    if (exact !== undefined) return exact
    const lower = candidate.toLowerCase()
    if (lower.startsWith('zh')) {
      return /tw|hk|mo|hant/.test(lower) ? 'zh-TW' : 'zh-CN'
    }
    if (lower.startsWith('fr')) return 'fr-FR'
  }
  return 'en-US'
}
