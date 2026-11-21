import { describe, expect, it } from 'vitest'
import { instrumentLabel } from '@/components/instrumentMeta'
import { enUS } from '@/locales/en-US'
import { frFR } from '@/locales/fr-FR'
import { zhCN } from '@/locales/zh-CN'
import { zhTW } from '@/locales/zh-TW'
import { INSTRUMENT_TYPES } from '@/types/audio'

describe('instrumentMeta', () => {
  it('四种语言下每种乐器都有非空标签', () => {
    for (const t of [enUS, zhCN, zhTW, frFR]) {
      for (const type of INSTRUMENT_TYPES) {
        expect(instrumentLabel(t, type).length, `${type}`).toBeGreaterThan(0)
      }
    }
  })

  it('en-US 标签映射正确', () => {
    expect(instrumentLabel(enUS, 'piano')).toBe('Piano')
    expect(instrumentLabel(enUS, 'saxophone')).toBe('Saxophone')
    expect(instrumentLabel(enUS, 'bass')).toBe('Bass')
  })

  it('2026-11 增补五种乐器四语言标签', () => {
    expect(instrumentLabel(enUS, 'clarinet')).toBe('Clarinet')
    expect(instrumentLabel(enUS, 'frenchHorn')).toBe('French Horn')
    expect(instrumentLabel(enUS, 'trombone')).toBe('Trombone')
    expect(instrumentLabel(enUS, 'cello')).toBe('Cello')
    expect(instrumentLabel(enUS, 'guitarNylon')).toBe('Classical Guitar')
    expect(instrumentLabel(zhCN, 'clarinet')).toBe('单簧管')
    expect(instrumentLabel(zhCN, 'frenchHorn')).toBe('圆号')
    expect(instrumentLabel(zhCN, 'trombone')).toBe('长号')
    expect(instrumentLabel(zhCN, 'cello')).toBe('大提琴')
    expect(instrumentLabel(zhCN, 'guitarNylon')).toBe('古典吉他')
    expect(instrumentLabel(zhTW, 'guitarNylon')).toBe('古典吉他')
    expect(instrumentLabel(frFR, 'guitarNylon')).toBe('Guitare classique')
  })

  it('guitar（钢弦）与 guitarNylon（古典）标签在四语言下均不同名（持久化 key 不变，靠 label 分化）', () => {
    for (const t of [enUS, zhCN, zhTW, frFR]) {
      expect(instrumentLabel(t, 'guitar')).not.toBe(instrumentLabel(t, 'guitarNylon'))
    }
  })
})
