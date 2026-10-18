import { useEffect, useRef, type RefObject } from 'react'

/** 双击判定窗口（ms）：覆盖触控双击的常见节奏（≤300ms），同时落在桌面原生 dblclick 阈值（Chrome 500ms）内 */
export const DOUBLE_TAP_DELAY_MS = 400

/** 两击允许的最大位移（px）：手指落点天然抖动，宽于拖拽起板 slop（docs/selection.md §4.2 用 4px） */
export const DOUBLE_TAP_SLOP_PX = 24

export interface DoubleTapOptions {
  /** 判定窗口，默认 400ms */
  delayMs?: number
  /** 两击最大位移，默认 24px */
  slopPx?: number
  /** 时钟注入（测试用），默认 performance.now */
  now?: () => number
}

interface PendingTap {
  at: number
  x: number
  y: number
}

/**
 * 跨平台双击/双触检测（AGENTS.md：交互必须同时支持 PC 鼠标与 iPad 触控）。
 * 原生 dblclick 在 iOS/iPadOS Safari 触控下不触发（WebKit bug 202143，双击只产生
 * mouse 兼容序列与 click），双击语义不能只挂 dblclick；本 hook 以两次 pointerdown 的
 * 时间窗 + 位移判定，鼠标/触控/触控笔统一。监听挂在 document 上并按 ref 包含性过滤，
 * 因此 ref 目标条件渲染（如波形容器）也无碍。
 *
 * 处理函数必须幂等：桌面上原生 dblclick 与本检测会先后触发，由消费方状态护栏去重。
 */
export function useDoubleTap(
  ref: RefObject<HTMLElement | null>,
  onDoubleTap: (event: PointerEvent) => void,
  options: DoubleTapOptions = {},
): void {
  // 配置经 ref 读取，effect 只随 ref 挂载一次，回调/阈值热更新不重挂监听
  const settingsRef = useRef({
    onDoubleTap,
    delayMs: options.delayMs ?? DOUBLE_TAP_DELAY_MS,
    slopPx: options.slopPx ?? DOUBLE_TAP_SLOP_PX,
    now: options.now ?? (() => performance.now()),
  })
  // 热更新在渲染后写 ref（react-hooks/refs：不在 render 期改 ref）；pointerdown 总在 effect 之后，读到的是最新值
  useEffect(() => {
    settingsRef.current = {
      onDoubleTap,
      delayMs: options.delayMs ?? DOUBLE_TAP_DELAY_MS,
      slopPx: options.slopPx ?? DOUBLE_TAP_SLOP_PX,
      now: options.now ?? (() => performance.now()),
    }
  })
  const pendingRef = useRef<PendingTap | null>(null)

  useEffect(() => {
    function reset(): void {
      pendingRef.current = null
    }
    function handlePointerDown(event: PointerEvent): void {
      if (event.isPrimary === false) return // 多指第二落点不参与双击
      const container = ref.current
      if (container === null || !container.contains(event.target as Node)) {
        reset() // 容器外的按下打断双击节奏
        return
      }
      const { onDoubleTap: callback, delayMs, slopPx, now } = settingsRef.current
      const current: PendingTap = { at: now(), x: event.clientX, y: event.clientY }
      const pending = pendingRef.current
      if (
        pending !== null &&
        current.at - pending.at <= delayMs &&
        Math.hypot(current.x - pending.x, current.y - pending.y) <= slopPx
      ) {
        pendingRef.current = null
        callback(event)
        return
      }
      pendingRef.current = current
    }
    function handlePointerCancel(): void {
      reset()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointercancel', handlePointerCancel)
      reset()
    }
  }, [ref])
}
