import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  /** Space：播放 / 停止切换 */
  onPlayToggle: () => void
  /** Esc：停止 */
  onStop: () => void
  /** Esc：停止并清除（tech.md §6.3）；缺省回落 onStop */
  onEscape?: () => void
  /** false 时整体停用（如弹窗打开、由弹窗自身接管 Esc） */
  enabled?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  )
}

/** 全局快捷键（docs/tech.md §6.3）：Space 播放/停止，Esc 停止并清除；输入框聚焦时忽略。 */
export function useKeyboardShortcuts({ onPlayToggle, onStop, onEscape, enabled = true }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        onPlayToggle()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        if (onEscape === undefined) onStop()
        else onEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onPlayToggle, onStop, onEscape])
}
