import { createContext } from 'react'
import type { ThemeId } from '../themes'

export interface ThemeContextValue {
  /** 当前皮肤 id */
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
