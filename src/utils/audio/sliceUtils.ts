/**
 * 原曲切片钳制/循环计划（docs/audio.md §5.3，纯函数、单一钳制入口）。
 * UI 显示与循环播放共用此函数，保证「显示的切片」与「循环的切片」永远一致。
 */

/** 切片短于 0.05s 拒绝循环（F10 规则） */
export const MIN_SLICE_SECONDS = 0.05

export interface AudioLoopPlan {
  /** 循环起点（秒，钳制后） */
  offset: number
  /** 切片时长（秒，钳制后） */
  duration: number
  /** 一整轮时长 = duration + max(0, gapSeconds) */
  cycleDuration: number
  /** duration ≥ MIN_SLICE_SECONDS 才允许循环 */
  loop: boolean
}

export function buildAudioLoopPlan(
  startTime: number,
  endTime: number,
  gapSeconds: number,
  bufferDuration: number,
): AudioLoopPlan {
  const lower = Math.max(0, Math.min(startTime, endTime))
  const upper = Math.min(Math.max(0, bufferDuration), Math.max(startTime, endTime))
  const duration = Math.max(0, upper - lower)
  const gap = Math.max(0, gapSeconds)
  return { offset: lower, duration, cycleDuration: duration + gap, loop: duration >= MIN_SLICE_SECONDS }
}

// ---- 波形双击命中（触控删切片：iOS/iPadOS 不触发原生 dblclick，删除由 pointer 双击检测驱动） ----

/** 波形横轴落点是否落在切片区间内（含边界）。width/duration 非正（如 jsdom 零矩形、未就绪）一律不命中 */
export function isTapWithinSlice(
  offsetX: number,
  width: number,
  duration: number,
  slice: { startTime: number; endTime: number },
): boolean {
  if (!(width > 0) || !(duration > 0)) return false
  const time = (offsetX / width) * duration
  return time >= slice.startTime && time <= slice.endTime
}



/** 缩放上限（px/秒）：1px ≈ 0.5ms，足够精准定位切片边界 */
export const ZOOM_MAX_PX_PER_SEC = 2000

/** 「当前缩放视为适应窗口」的浮点阈值（>1 即按比例比较，避开裸浮点 ===） */
export const ZOOM_FIT_EPSILON = 1.001

/** 放大一步：基准 = max(当前, 适应宽度)，×2 后钳到 maxPxPerSec */
export function zoomInPx(currentPxPerSec: number, fitPxPerSec: number, maxPxPerSec = ZOOM_MAX_PX_PER_SEC): number {
  const base = Math.max(currentPxPerSec, fitPxPerSec)
  return Math.min(base * 2, maxPxPerSec)
}

/** 缩小一步：基准折半，但不低于适应宽度 */
export function zoomOutPx(currentPxPerSec: number, fitPxPerSec: number): number {
  const base = Math.max(currentPxPerSec, fitPxPerSec)
  return Math.max(fitPxPerSec, base / 2)
}

/** 缩放百分比显示（相对适应宽度，最小 100%；适应宽度不可得时恒 100） */
export function zoomPercent(currentPxPerSec: number, fitPxPerSec: number): number {
  if (!(fitPxPerSec > 0)) return 100
  return Math.max(100, Math.round((currentPxPerSec / fitPxPerSec) * 100))
}

/** m:ss（40 → "0:40"，654 → "10:54"） */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "812 KB" / "8.4 MB"（不足 1 KB 向上取整为 1 KB） */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
