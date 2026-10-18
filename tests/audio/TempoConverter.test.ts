import { describe, expect, it } from 'vitest'
import { realValueToSeconds, beatsToSeconds } from '@/audio/TempoConverter'

describe('TempoConverter（拍 ↔ 秒唯一换算入口，docs/audio.md §2.1）', () => {
  it('realValueToSeconds：附点四分 0.375 @ 90 BPM = 1.000s（spike §13-V7 端到端锚点）', () => {
    expect(realValueToSeconds(0.375, 90)).toBeCloseTo(1.0, 9)
  })

  it('realValueToSeconds：四分 0.25 @ 60 BPM = 1s，全音符 = 4s；0 → 0', () => {
    expect(realValueToSeconds(0.25, 60)).toBe(1)
    expect(realValueToSeconds(1, 60)).toBe(4)
    expect(realValueToSeconds(0, 120)).toBe(0)
  })

  it('beatsToSeconds：默认四分拍；beatValue=8 时减半', () => {
    expect(beatsToSeconds(1, 60)).toBe(1)
    expect(beatsToSeconds(4, 120)).toBe(2)
    expect(beatsToSeconds(1, 60, 8)).toBe(0.5)
    expect(beatsToSeconds(0, 90)).toBe(0)
  })
})
