import { describe, expect, it } from 'vitest'

import {
  MIN_SLICE_SECONDS,
  ZOOM_MAX_PX_PER_SEC,
  buildAudioLoopPlan,
  formatFileSize,
  formatTime,
  isTapWithinSlice,
  zoomInPx,
  zoomOutPx,
  zoomPercent,
} from '@/utils/audio/sliceUtils'

describe('buildAudioLoopPlan（docs/audio.md §5.3）', () => {
  it('正常切片：offset/duration/cycleDuration/loop', () => {
    expect(buildAudioLoopPlan(10, 25, 2, 120)).toEqual({
      offset: 10,
      duration: 15,
      cycleDuration: 17,
      loop: true,
    })
  })

  it('起止乱序先换位（A3 域内钳制）', () => {
    expect(buildAudioLoopPlan(25, 10, 0, 120)).toMatchObject({ offset: 10, duration: 15, loop: true })
  })

  it('钳制到 [0, bufferDuration]', () => {
    expect(buildAudioLoopPlan(-5, 30, 0, 20)).toMatchObject({ offset: 0, duration: 20 })
    expect(buildAudioLoopPlan(10, 500, 0, 20)).toMatchObject({ offset: 10, duration: 10 })
    expect(buildAudioLoopPlan(-10, -1, 0, 20)).toMatchObject({ offset: 0, duration: 0, loop: false })
  })

  it(`duration < ${MIN_SLICE_SECONDS}s 拒绝循环（F10）；恰好阈值允许`, () => {
    expect(buildAudioLoopPlan(0, 0.04, 0, 10).loop).toBe(false)
    expect(buildAudioLoopPlan(0, MIN_SLICE_SECONDS, 0, 10).loop).toBe(true)
  })

  it('负 gap 钳为 0；cycleDuration = duration + gap', () => {
    expect(buildAudioLoopPlan(0, 5, -1, 10).cycleDuration).toBe(5)
    expect(buildAudioLoopPlan(0, 5, 1.5, 10).cycleDuration).toBe(6.5)
  })
})

describe('波形缩放阶梯（docs/audio.md §5.1 决策 A13）', () => {
  it('zoomInPx：以 max(当前, 适应宽度) 为基准倍增，钳到上限', () => {
    expect(zoomInPx(10, 10)).toBe(20)
    expect(zoomInPx(0, 10)).toBe(20)
    expect(zoomInPx(25, 10)).toBe(50)
    expect(zoomInPx(ZOOM_MAX_PX_PER_SEC - 1, 10)).toBe(ZOOM_MAX_PX_PER_SEC)
    expect(zoomInPx(3000, 10)).toBe(ZOOM_MAX_PX_PER_SEC)
  })

  it('zoomOutPx：基准折半，但不低于适应宽度', () => {
    expect(zoomOutPx(40, 10)).toBe(20)
    expect(zoomOutPx(25, 10)).toBe(12.5)
    expect(zoomOutPx(12.5, 10)).toBe(10)
    expect(zoomOutPx(10, 10)).toBe(10)
    expect(zoomOutPx(0, 10)).toBe(10)
  })

  it('zoomPercent：相对适应宽度取整，最小 100；适应宽度不可得恒 100', () => {
    expect(zoomPercent(10, 10)).toBe(100)
    expect(zoomPercent(10.01, 10)).toBe(100)
    expect(zoomPercent(25, 10)).toBe(250)
    expect(zoomPercent(9, 10)).toBe(100)
    expect(zoomPercent(30, 0)).toBe(100)
  })
})

describe('显示格式化', () => {
  it('formatTime：m:ss，负值钳为 0', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(40)).toBe('0:40')
    expect(formatTime(654)).toBe('10:54')
    expect(formatTime(204.4)).toBe('3:24')
    expect(formatTime(-3)).toBe('0:00')
  })

  it('formatFileSize：KB/MB，不足 1 KB 取 1 KB', () => {
    expect(formatFileSize(0)).toBe('1 KB')
    expect(formatFileSize(120 * 1024)).toBe('120 KB')
    expect(formatFileSize(2.2 * 1024 * 1024)).toBe('2.2 MB')
  })
})

describe('isTapWithinSlice（波形双击命中）', () => {
  const slice = { startTime: 10, endTime: 20 }

  it('区间内命中；两端边界（含）也算命中', () => {
    expect(isTapWithinSlice(15, 100, 100, slice)).toBe(true)
    expect(isTapWithinSlice(10, 100, 100, slice)).toBe(true)
    expect(isTapWithinSlice(20, 100, 100, slice)).toBe(true)
  })

  it('区间外（两侧越界）不命中', () => {
    expect(isTapWithinSlice(9, 100, 100, slice)).toBe(false)
    expect(isTapWithinSlice(21, 100, 100, slice)).toBe(false)
    expect(isTapWithinSlice(-1, 100, 100, slice)).toBe(false)
  })

  it('宽度/时长非正（jsdom 零矩形、未就绪）一律不命中', () => {
    expect(isTapWithinSlice(15, 0, 100, slice)).toBe(false)
    expect(isTapWithinSlice(15, 100, 0, slice)).toBe(false)
    expect(isTapWithinSlice(15, -10, 100, slice)).toBe(false)
  })
})
