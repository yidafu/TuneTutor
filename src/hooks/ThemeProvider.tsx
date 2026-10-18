import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { resolveTheme, THEME_STORAGE_KEY, type ThemeId } from '../themes'
import { ThemeContext } from './themeContext'

function detectInitialTheme() {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return resolveTheme(null)
  }
}

/**
 * 皮肤全局状态。首帧值由 index.html 内联脚本写入 dataset.theme 防闪白，
 * Provider 不在挂载时回写；换肤本体由 dataset.theme 上的 token 级联（CSS）完成，
 * React 状态驱动切换器选中态与随皮肤重渲染的图标集（components/icons）。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(detectInitialTheme)

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 配额 / 隐私模式下写入失败：切换仅对当前会话生效
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
