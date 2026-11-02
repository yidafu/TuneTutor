import { describe, expect, it } from 'vitest'

import {
  anchoredScrollLeft,
  clampedScroll,
  pinchMidpoint,
  pinchSpan,
  targetPinchZoom,
} from '@/utils/notation/pinchZoom'

describe('pinchSpan / pinchMidpoint', () => {
  it('跨度 = 两指欧氏距离，中点 = 均值', () => {
    expect(pinchSpan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(pinchSpan({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
    const mid = pinchMidpoint({ x: 100, y: 40 }, { x: 220, y: 60 })
    expect(mid).toEqual({ x: 160, y: 50 })
  })

  it('中点对两指顺序对称', () => {
    expect(pinchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual(
      pinchMidpoint({ x: 10, y: 20 }, { x: 0, y: 0 }),
    )
  })
})

describe('targetPinchZoom', () => {
  it('按跨度比值缩放（zoom0 × span/span0）', () => {
    expect(targetPinchZoom(1, 100, 200, 0.5, 2)).toBe(2)
    expect(targetPinchZoom(1.2, 200, 100, 0.5, 2)).toBeCloseTo(0.6, 10)
    expect(targetPinchZoom(1, 100, 100, 0.5, 2)).toBe(1)
  })

  it('钳制到 [min, max]', () => {
    expect(targetPinchZoom(1, 100, 500, 0.5, 2)).toBe(2)
    expect(targetPinchZoom(1, 100, 10, 0.5, 2)).toBe(0.5)
  })

  it('span0 非法（0/负）时原样返回 zoom0，不放大', () => {
    expect(targetPinchZoom(1, 0, 200, 0.5, 2)).toBe(1)
    expect(targetPinchZoom(1, -5, 200, 0.5, 2)).toBe(1)
  })
})

describe('clampedScroll', () => {
  it('收在 [0, scrollWidth - clientWidth]', () => {
    expect(clampedScroll(60, 2000, 800)).toBe(60)
    expect(clampedScroll(-10, 2000, 800)).toBe(0)
    expect(clampedScroll(5000, 2000, 800)).toBe(1200)
  })

  it('无溢出（jsdom 0 宽）时恒为 0', () => {
    expect(clampedScroll(30, 0, 0)).toBe(0)
    expect(clampedScroll(30, 800, 800)).toBe(0)
  })
})

describe('anchoredScrollLeft', () => {
  it('锚点内容点按总宽比例外推后回到原视口位置', () => {
    // 重排前：scroll 400，锚点在视口 100 → 内容点 500；总宽 1000 → 2000 后
    // 内容点 1000，回到视口 100 需 scroll 900
    expect(anchoredScrollLeft(400, 100, 1000, 2000)).toBeCloseTo(900, 10)
  })

  it('总宽不变时滚动原样保留', () => {
    expect(anchoredScrollLeft(400, 100, 1000, 1000)).toBeCloseTo(400, 10)
  })

  it('总宽非法（0）时回退原滚动，不产生 NaN', () => {
    expect(anchoredScrollLeft(400, 100, 0, 2000)).toBe(400)
    expect(anchoredScrollLeft(400, 100, 1000, 0)).toBe(400)
  })
})
