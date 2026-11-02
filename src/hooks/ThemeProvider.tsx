import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveTheme, THEME_STORAGE_KEY, type ThemeId } from '../themes'
import { ThemeContext } from './themeContext'

function detectInitialTheme() {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return resolveTheme(null)
  }
}

/** Safari/iPadOS 浏览器框色随皮肤画布走（触控专项：暗色皮肤顶栏不再残留亮纸色） */
function syncThemeColorMeta(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta === null) return
  const canvas = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
  if (canvas !== '') meta.content = canvas
}

/**
 * 皮肤全局状态。首帧值由 index.html 内联脚本写入 dataset.theme 防闪白，
 * Provider 不在挂载时回写；换肤本体由 dataset.theme 上的 token 级联（CSS）完成，
 * React 状态驱动切换器选中态与随皮肤重渲染的图标集（components/icons）。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(detectInitialTheme)

  // 挂载同步（首帧由内联脚本决定，含 storage 里的旧值）+ 换肤同步浏览器框色
  useEffect(() => {
    syncThemeColorMeta()
  }, [theme])

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    syncThemeColorMeta()
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 配额 / 隐私模式下写入失败：切换仅对当前会话生效
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
