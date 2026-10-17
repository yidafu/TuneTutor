import { useEffect, useRef, type RefObject } from 'react'

/** 点击 ref 容器外部时触发回调（用于浮层关闭）。 */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onOutside])

  return ref
}
