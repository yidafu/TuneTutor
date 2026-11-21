import { useEffect, useState, type RefObject } from 'react'

/** 触发钮矩形中钳制用得到的水平几何（DOMRect 的结构子集，便于纯函数测试） */
export interface ClampRect {
  left: number
  right: number
}

/**
 * 弹层水平钳制偏移（phone-compat P3）：menuPop 右对齐挂在触发钮下方，
 * 窄屏触发钮贴左缘时弹层左沿溢出视口。返回 translateX 偏移量：
 * 0 = 无需钳制；正数 = 右移（左溢）；负数 = 左移（右溢）。
 * 视口容不下弹层（含两侧边距）时退化为「左边距对齐」，宽度钳制交给
 * menuPop 的 maxWidth 兜底。纯函数，测试直喂几何值。
 */
export function clampPopoverX(
  trigger: ClampRect,
  popWidth: number,
  viewportWidth: number,
  margin = 8,
): number {
  // 右对齐锚定下的弹层默认投影
  const left = trigger.right - popWidth
  const right = left + popWidth
  const slack = viewportWidth - margin * 2 - popWidth
  if (slack <= 0) return margin - left // 视口窄于弹层：贴左边距，右溢由 maxWidth 裁
  if (left < margin) return margin - left
  if (right > viewportWidth - margin) return viewportWidth - margin - right
  return 0
}

/** 钳制偏移 → 弹层内联 style（0 不写，保持右对齐原位） */
export function clampTransform(offsetX: number): { transform: string } | undefined {
  return offsetX === 0 ? undefined : { transform: `translateX(${offsetX}px)` }
}

/** 默认视口宽读取（模块级常量：内联默认参数每次渲染换新引用，会让 effect 依赖抖动） */
function readViewportWidth(): number {
  return window.innerWidth
}

/**
 * 弹层开启期间按锚盒几何维持钳制偏移：开启时测量一次，resize 跟随
 * （锚在吸顶/吸底条内不随页面滚动漂移，无需监听 scroll）。
 * 弹层宽度由调用方按各自样式传入；视口读取注入以便测试（须传稳定引用）。
 */
export function usePopoverClamp(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  popWidth: number,
  getViewportWidth: () => number = readViewportWidth,
): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!open) return
    const measure = (): void => {
      const anchor = anchorRef.current
      if (anchor === null) return
      setOffset(clampPopoverX(anchor.getBoundingClientRect(), popWidth, getViewportWidth()))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      setOffset(0)
    }
  }, [anchorRef, open, popWidth, getViewportWidth])

  return offset
}
