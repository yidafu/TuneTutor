import { describe, expect, it } from 'vitest'
import { INSTRUMENT_EMOJI, instrumentLabel } from '@/components/instrumentMeta'
import { enUS } from '@/locales/en-US'
import { frFR } from '@/locales/fr-FR'
import { zhCN } from '@/locales/zh-CN'
import { zhTW } from '@/locales/zh-TW'
import { INSTRUMENT_TYPES } from '@/types/audio'

describe('instrumentMeta', () => {
  it('emoji 覆盖全部 7 种乐器', () => {
    expect(Object.keys(INSTRUMENT_EMOJI).sort()).toEqual([...INSTRUMENT_TYPES].sort())
    for (const type of INSTRUMENT_TYPES) {
      expect(INSTRUMENT_EMOJI[type].length, type).toBeGreaterThan(0)
    }
  })

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
})
