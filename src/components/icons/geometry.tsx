import type { ReactNode } from 'react'
import type { ThemeId } from '../../themes'
import { CELADON_ICON_SET } from './sets/celadon'
import { COBALT_ICON_SET } from './sets/cobalt'
import { LACQUER_ICON_SET } from './sets/lacquer'
import { NOCTURNE_ICON_SET } from './sets/nocturne'
import { PALACE_ICON_SET } from './sets/palace'
import { PAPER_ICON_SET } from './sets/paper'
import { ROSEWOOD_ICON_SET } from './sets/rosewood'
import { STAGE_ICON_SET } from './sets/stage'
import { WALNUT_ICON_SET } from './sets/walnut'

/**
 * 图标类型与每主题注册表（24×24 viewBox，单色 currentColor）。
 *
 * 2026-10-18 用户决策：九款皮肤<b>每主题专形专绘一整套</b>（取代
 * skin-switching.html v1.2「同一几何 × 各肤笔触」方案）——各集以
 * sets/paper.tsx 的版画线描为构图基准，按本主题的工艺语言重绘：
 * 夜曲细笔减线、暖木圆木浑厚、青瓷釉线冰裂、演奏会聚光高对比、
 * 青花料点水纹、宫墙方折回纹、红木铜钉榫卯、玄漆描金云头。
 * 笔触参数（线宽/端头/点缀填充）仍由 styles.ts 的 THEME_ICON_STYLES 承载，
 * 与专形几何在此正交叠加。
 *
 * `paths` 为主体描线；`accents` 是可填充的附属点缀（音孔 / 符头 / 摆锤 / 耳罩），
 * 必须是有面积的闭合形，不能是纯线条；`solid` 图标恒 fill=currentColor。
 */
export type ThemeIconName =
  | 'piano'
  | 'sax'
  | 'clarinet'
  | 'flute'
  | 'trumpet'
  | 'horn'
  | 'trombone'
  | 'violin'
  | 'cello'
  | 'guitar'
  | 'classical'
  | 'bass'
  | 'play'
  | 'stop'
  | 'metro'
  | 'loop'
  | 'gear'
  | 'folder'
  | 'note'
  | 'trash'
  | 'phones'
  | 'palette'

export interface IconGeometry {
  /** 主体描线子路径 */
  paths: ReactNode
  /** 附属点缀：描边主题下为空心线描，填充主题下为实心色块 */
  accents?: ReactNode
  /** 恒实心（fill = currentColor），如播放 / 停止走带键 */
  solid?: boolean
}

/** 一套完整的 22 枚主题图标（类型层面强制每集全量定义；乐器 12 枚 + 功能 10 枚） */
export type IconSet = Record<ThemeIconName, IconGeometry>

export const THEME_ICON_SETS: Record<ThemeId, IconSet> = {
  paper: PAPER_ICON_SET,
  nocturne: NOCTURNE_ICON_SET,
  walnut: WALNUT_ICON_SET,
  celadon: CELADON_ICON_SET,
  stage: STAGE_ICON_SET,
  cobalt: COBALT_ICON_SET,
  palace: PALACE_ICON_SET,
  rosewood: ROSEWOOD_ICON_SET,
  lacquer: LACQUER_ICON_SET,
}
