import { describe, expect, it } from 'vitest'
import { enUS } from '@/locales/en-US'
import { frFR } from '@/locales/fr-FR'
import { LANGUAGES, resolveLanguage } from '@/locales/languages'
import { zhCN } from '@/locales/zh-CN'
import { zhTW } from '@/locales/zh-TW'

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
