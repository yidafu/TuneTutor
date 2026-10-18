import type { ThemeId } from '../../themes'

/**
 * 每主题一套图标（2026-10-18 用户决策，取代设计稿 T10 的「只换色不换形」；
 * 品牌标不在此列——反复记号几何恒定仍按 docs/brand.html 铁律）。
 * 同一几何库（geometry.tsx）经各主题笔触渲染出观感不同的九套图标：
 */
export interface ThemeIconStyle {
  /** 描线宽（24 viewBox 基准） */
  strokeWidth: number
  linecap: 'round' | 'butt' | 'square'
  linejoin: 'round' | 'miter' | 'bevel'
  /** 附属件（音孔/符头/按键等 accents）渲染：stroke=空心线描，fill=实心色块 */
  accents: 'stroke' | 'fill'
}

export const THEME_ICON_STYLES: Record<ThemeId, ThemeIconStyle> = {
  /** 纸墨：版画线描，匀速中锋（v1.2 图标规格基准线宽） */
  paper: { strokeWidth: 1.75, linecap: 'round', linejoin: 'round', accents: 'stroke' },
  /** 夜曲：细线夜笔，轻盈低干扰 */
  nocturne: { strokeWidth: 1.25, linecap: 'round', linejoin: 'round', accents: 'stroke' },
  /** 暖木：圆木浑厚，实心点缀 */
  walnut: { strokeWidth: 2.1, linecap: 'round', linejoin: 'round', accents: 'fill' },
  /** 青瓷：釉线匀细 */
  celadon: { strokeWidth: 1.5, linecap: 'round', linejoin: 'round', accents: 'stroke' },
  /** 演奏会：聚光高对比，粗线实心（无障碍选项） */
  stage: { strokeWidth: 2.3, linecap: 'round', linejoin: 'round', accents: 'fill' },
  /** 青花：细笔勾线 + 料点（釉里红/苏麻离青的点染） */
  cobalt: { strokeWidth: 1.2, linecap: 'round', linejoin: 'round', accents: 'fill' },
  /** 宫墙：宫式方折，方头齐线 */
  palace: { strokeWidth: 2, linecap: 'square', linejoin: 'miter', accents: 'fill' },
  /** 红木：黄铜嵌线，中锋 + 铜钉点缀 */
  rosewood: { strokeWidth: 1.7, linecap: 'round', linejoin: 'round', accents: 'fill' },
  /** 玄漆：描金勾线 + 漆点 */
  lacquer: { strokeWidth: 1.5, linecap: 'round', linejoin: 'round', accents: 'fill' },
}
