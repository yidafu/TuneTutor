import { useEffect, useRef, type RefObject } from 'react'

/** 点击 ref 容器外部时触发回调（用于浮层关闭）。 */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    // Pointer Events 统一鼠标/触控/触控笔（iPad 点按不产生可靠的 mousedown 兼容事件）
    function handlePointerDown(event: PointerEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onOutside])

  return ref
}
