import { describe, expect, it } from 'vitest'
import { enUS } from '@/locales/en-US'
import { frFR } from '@/locales/fr-FR'
import { LANGUAGES, resolveLanguage } from '@/locales/languages'
import { zhCN } from '@/locales/zh-CN'
import { zhTW } from '@/locales/zh-TW'
import { THEMES } from '@/themes'

type TranslationTree = Record<string, unknown>

function keyPaths(tree: TranslationTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return value !== null && typeof value === 'object'
      ? keyPaths(value as TranslationTree, path)
      : [path]
  })
}

function resolvePath(tree: TranslationTree, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as TranslationTree)[key], tree)
}

describe('locales', () => {
  const enKeys = keyPaths(enUS).sort()

  it('四语言 key 集合完全一致（KR3 硬约束）', () => {
    expect(enKeys.length).toBeGreaterThan(0)
    expect(keyPaths(zhCN).sort()).toEqual(enKeys)
    expect(keyPaths(zhTW).sort()).toEqual(enKeys)
    expect(keyPaths(frFR).sort()).toEqual(enKeys)
  })

  it('每个叶子节点都是非空字符串或插值函数', () => {
    for (const tree of [enUS, zhCN, zhTW, frFR]) {
      for (const path of keyPaths(tree)) {
        const value = resolvePath(tree, path)
        if (typeof value === 'string') {
          expect(value.length, path).toBeGreaterThan(0)
        } else {
          expect(typeof value, path).toBe('function')
        }
      }
    }
  })
})

describe('theme.* 键（skin-switching §③：四语言全量硬约束）', () => {
  it('四语言均含 13 个 theme 键（label/group×2/九款皮肤/appliedHint）', () => {
    const expectedThemeKeys = [
      'label',
      'group',
      'paper',
      'nocturne',
      'walnut',
      'celadon',
      'stage',
      'cobalt',
      'palace',
      'rosewood',
      'lacquer',
      'appliedHint',
    ].sort()
    for (const tree of [enUS, zhCN, zhTW, frFR]) {
      expect(Object.keys(tree.theme).sort()).toEqual(expectedThemeKeys)
      expect(Object.keys(tree.theme.group).sort()).toEqual(['antique', 'classic'])
    }
  })

  it('每款皮肤 id 在四语言下都有名称（与 themes.ts 注册表对齐）', () => {
    for (const theme of THEMES) {
      for (const tree of [enUS, zhCN, zhTW, frFR]) {
        expect(typeof tree.theme[theme], `${theme}`).toBe('string')
        expect(tree.theme[theme].length, `${theme}`).toBeGreaterThan(0)
      }
    }
  })

  it('关键取值符合设计稿键表', () => {
    expect(zhCN.theme.paper).toBe('纸墨')
    expect(zhTW.theme.palace).toBe('宮牆')
    expect(frFR.theme.label).toBe('Thème')
    expect(enUS.theme.cobalt).toBe('Blue & White')
    expect(zhCN.theme.group.antique).toBe('古风')
  })
})

describe('resolveLanguage', () => {
  it('存储值合法时优先生效', () => {
    expect(resolveLanguage('fr-FR', ['en-US'])).toBe('fr-FR')
    expect(resolveLanguage('zh-TW', ['en-US'])).toBe('zh-TW')
  })

  it('存储值非法时回落到浏览器语言（按候选顺序）', () => {
    expect(resolveLanguage(null, ['ja-JP', 'fr'])).toBe('fr-FR')
    expect(resolveLanguage('xx-XX', ['zh-TW'])).toBe('zh-TW')
  })

  it('中文变体映射：简体默认，繁体地区归 zh-TW', () => {
    expect(resolveLanguage(null, ['zh'])).toBe('zh-CN')
    expect(resolveLanguage(null, ['zh-CN'])).toBe('zh-CN')
    expect(resolveLanguage(null, ['zh-Hant-TW'])).toBe('zh-TW')
    expect(resolveLanguage(null, ['zh-HK'])).toBe('zh-TW')
  })

  it('无法识别时默认 en-US', () => {
    expect(resolveLanguage(null, ['de-DE', 'ja'])).toBe('en-US')
    expect(resolveLanguage(null, [])).toBe('en-US')
  })

  it('支持全部四种语言码', () => {
    for (const language of LANGUAGES) {
      expect(resolveLanguage(language, [])).toBe(language)
    }
  })
})
