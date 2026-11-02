/**
 * 乐谱面双指视口手势的纯数学（PRD G12 触控专项）：捏合跨度 → 目标缩放钳制、
 * 双指中点 → 平移位移、提交缩放后的滚动锚定。不含 DOM：几何/钳制规则可在
 * jsdom 下直接单测；DOM 接线（指针跟踪、transform 预览）在 OsmdNotation。
 */

export interface PinchPoint {
  x: number
  y: number
}

/** 两指跨度（px）：低于此值视为误触并拢，不进入捏合（手指落点天然抖动） */
export const PINCH_MIN_SPAN_PX = 24

/** 提交缩放的死区：跨度比值折算的缩放变化小于此值不触发重排 */
export const PINCH_ZOOM_EPSILON = 0.001

/** 两指跨度（欧氏距离） */
export function pinchSpan(a: PinchPoint, b: PinchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 两指中点（平移锚点） */
export function pinchMidpoint(a: PinchPoint, b: PinchPoint): PinchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** 捏合比值 → 目标缩放：zoom0 × (span/span0)，钳制到 [min, max] */
export function targetPinchZoom(
  zoom0: number,
  span0: number,
  span: number,
  min: number,
  max: number,
): number {
  if (span0 <= 0) return zoom0
  const raw = zoom0 * (span / span0)
  return Math.min(max, Math.max(min, raw))
}

/** 平移钳制：中点位移换算的 scrollLeft 收在可滚动范围内（jsdom/未溢出时范围 = [0, 0]） */
export function clampedScroll(offset: number, scrollWidth: number, clientWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth)
  return Math.min(max, Math.max(0, offset))
}

/**
 * 提交缩放后的水平锚定：捏合中点下的谱面内容点在重排后仍留在原视口位置。
 * before = 重排前滚动状态 + 锚点视口 x；after 总宽按新缩放等比外推。
 */
export function anchoredScrollLeft(
  beforeOffset: number,
  anchorViewportX: number,
  beforeTotal: number,
  afterTotal: number,
): number {
  if (beforeTotal <= 0 || afterTotal <= 0) return beforeOffset
  return ((beforeOffset + anchorViewportX) / beforeTotal) * afterTotal - anchorViewportX
}
