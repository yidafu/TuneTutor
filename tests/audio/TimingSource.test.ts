import { describe, expect, it } from 'vitest'
import { LinearTimingSource } from '@/audio/TimingSource'
import { realValueToSeconds, secondsToRealValue } from '@/audio/TempoConverter'

/** 可手推的虚拟时钟：now.value 即「AudioContext.currentTime」 */
function makeClock(bpm = 60, now = { value: 1000 }): LinearTimingSource {
  return new LinearTimingSource(() => now.value, bpm)
}

describe('LinearTimingSource（锚点时钟，docs/audio.md §3.9）', () => {
  it('锚点模型：未起播时 getCurrentTimestamp = anchor = 0', () => {
    const clock = makeClock(60)
    expect(clock.getCurrentTimestamp()).toBe(0)
  })

  it('秒表推进：@60BPM 推 1s = 0.25 RealValue（四分音符）', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    now.value += 1
    expect(clock.getCurrentTimestamp()).toBeCloseTo(0.25, 12)
    now.value += 3
    expect(clock.getCurrentTimestamp()).toBeCloseTo(1, 12)
  })

  it('setBpm 先重锚定当前时间戳再换速：变速不跳时刻（决策 A2）', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    now.value += 1 // ts = 0.25
    const before = clock.getCurrentTimestamp()
    clock.setBpm(120)
    expect(clock.getCurrentTimestamp()).toBeCloseTo(before, 12)
    now.value += 1 // 新速下 1s = 0.5 rv
    expect(clock.getCurrentTimestamp()).toBeCloseTo(0.25 + 0.5, 12)
  })

  it('setTimestampAndBpm：锚点直设任意时间戳（起播定位/count-in 支点）', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    clock.setTimestampAndBpm(5, 120)
    expect(clock.getCurrentTimestamp()).toBeCloseTo(5, 12)
    now.value += 1
    expect(clock.getCurrentTimestamp()).toBeCloseTo(5 + 0.5, 12)
  })

  it('getWaitingTimeInMs round 整毫秒；target 在过去时为负', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    // target 0.2505 rv @60 = 1.002s → 1002ms
    expect(clock.getWaitingTimeInMs(0.2505)).toBe(1002)
    now.value += 1.002 // ts = 0.2505：等待归零
    expect(clock.getWaitingTimeInMs(0.2505)).toBe(0)
    expect(clock.getWaitingTimeInMs(0)).toBeLessThan(0)
  })

  it('pause 冻结 / start 恢复：暂停期间时间轴与音频钟都不走（零漂移）', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    now.value += 1
    clock.pause()
    const frozenTs = clock.getCurrentTimestamp()
    now.value += 3
    expect(clock.getCurrentTimestamp()).toBe(frozenTs)
    expect(clock.getAudioNowSeconds()).toBe(1004)
    clock.start()
    now.value += 1
    expect(clock.getCurrentTimestamp()).toBeCloseTo(frozenTs + 0.25, 12)
  })

  it('暂停中 setTimestampAndBpm：保持冻结、锚到新值，恢复后从新值起算', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    now.value += 1
    clock.pause()
    clock.setTimestampAndBpm(2, 60)
    now.value += 5
    expect(clock.getCurrentTimestamp()).toBeCloseTo(2, 12)
    clock.start()
    now.value += 1
    expect(clock.getCurrentTimestamp()).toBeCloseTo(2.25, 12)
  })

  it('reset：锚点归零、重新起算、解除冻结', () => {
    const now = { value: 1000 }
    const clock = makeClock(60, now)
    clock.setTimestampAndBpm(7, 60)
    clock.pause()
    clock.reset()
    expect(clock.getCurrentTimestamp()).toBe(0)
    now.value += 1
    expect(clock.getCurrentTimestamp()).toBeCloseTo(0.25, 12)
  })

  it('getAudioNowSeconds 直通注入的音频钟', () => {
    const now = { value: 42.5 }
    const clock = makeClock(60, now)
    expect(clock.getAudioNowSeconds()).toBe(42.5)
  })

  it('换算自洽：secondsToRealValue 是 realValueToSeconds 的逆', () => {
    expect(secondsToRealValue(realValueToSeconds(0.375, 90), 90)).toBeCloseTo(0.375, 12)
    expect(secondsToRealValue(1, 240)).toBe(1)
  })
})
