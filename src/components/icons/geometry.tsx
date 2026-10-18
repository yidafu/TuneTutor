import type { ReactNode } from 'react'

/**
 * 图标几何库（24×24 viewBox）。17 枚路径为 skin-switching.html v1.2 §①-02
 * 「功能图标集规格」的定稿字形（stroke 基线 1.75 / 圆头圆角 / 单色 currentColor；
 * play·stop 实心；乐器 7 枚专形专绘、bass 以「机身 + 拾音器条」与 guitar 分化；
 * 节拍器为沙漏塔 + 摆锤）。
 *
 * 每主题一套：styles.ts 的 THEME_ICON_STYLES 以各皮肤笔触（线宽 / 端头 /
 * accents 填充与否）渲染同一几何，得到观感不同的九套图标。
 * `paths` 为主体描线；`accents` 是可填充的附属点缀（音孔 / 符头 / 摆锤 / 耳罩），
 * 必须是有面积的闭合形，不能是纯线条；`solid` 图标恒 fill=currentColor。
 */
export type ThemeIconName =
  | 'piano'
  | 'sax'
  | 'guitar'
  | 'bass'
  | 'violin'
  | 'flute'
  | 'trumpet'
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

export const ICON_GEOMETRY: Record<ThemeIconName, IconGeometry> = {
  piano: {
    paths: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="1.6" />
        <path d="M8 5.5v5.7M12 5.5v5.7M16 5.5v5.7" />
      </>
    ),
  },
  sax: {
    paths: (
      <>
        <path d="M17.2 2.8l-.7 2.4c-.9 4.4-6.3 5.4-6.3 9.3 0 3.1 2.5 5.2 5.7 5.2 2.6 0 4.5-1.3 5.1-3.3" />
        <path d="M21 16.4c.4-1 .5-2.1.4-3.2" />
        <path d="M18.3 6.2c-1.2 3.6-5.6 4.7-5.6 8.1 0 2.2 1.7 3.6 4 3.6" />
      </>
    ),
    accents: (
      <>
        <circle cx="14.4" cy="10.4" r="0.6" />
        <circle cx="13" cy="12.8" r="0.6" />
        <circle cx="13.3" cy="15.2" r="0.6" />
      </>
    ),
  },
  guitar: {
    paths: (
      <>
        <path d="M12 21.5c-3.4 0-6.2-2.3-6.2-5.3 0-1.9 1-3.3 2.4-4.2.9-.6 1.4-1.4 1.4-2.3V7h4.8v2.7c0 .9.5 1.7 1.4 2.3 1.4.9 2.4 2.3 2.4 4.2 0 3-2.8 5.3-6.2 5.3Z" />
        <circle cx="12" cy="15.4" r="2.1" />
        <path d="M9.2 7V3.6h5.6V7" />
        <path d="M10.6 3.6V2.2M13.4 3.6V2.2" />
      </>
    ),
  },
  bass: {
    paths: (
      <>
        <path d="M12 22c-3.1 0-5.6-2-5.6-4.6 0-1.7.9-3 2.2-3.8.8-.5 1.3-1.2 1.3-2.1V9h4.2v2.5c0 .9.5 1.6 1.3 2.1 1.3.8 2.2 2.1 2.2 3.8 0 2.6-2.5 4.6-5.6 4.6Z" />
        <path d="M10 16.2h4M10 18.1h4" />
        <path d="M9.9 9V3.2h4.2V9" />
        <path d="M10.8 3.2V1.8M13.2 3.2V1.8" />
      </>
    ),
  },
  violin: {
    paths: (
      <>
        <path d="M12 9.2c-1.9 0-3.3 1.2-3.3 2.9 0 1 .5 1.8 1.2 2.5-1.2.7-2 1.9-2 3.3 0 2.2 1.8 3.9 4.1 3.9s4.1-1.7 4.1-3.9c0-1.4-.8-2.6-2-3.3.7-.7 1.2-1.5 1.2-2.5 0-1.7-1.4-2.9-3.3-2.9Z" />
        <path d="M12 9.2V4.8" />
      </>
    ),
    accents: <circle cx="12" cy="3.5" r="1.1" />,
  },
  flute: {
    paths: (
      <>
        <rect x="2.8" y="9.8" width="18.4" height="4.4" rx="1.8" />
        <circle cx="6.2" cy="9.9" r="1.05" />
      </>
    ),
    accents: (
      <>
        <circle cx="10.6" cy="12.4" r="0.65" />
        <circle cx="13.6" cy="12.4" r="0.65" />
        <circle cx="16.6" cy="12.4" r="0.65" />
      </>
    ),
  },
  trumpet: {
    paths: (
      <>
        <path d="M2.6 12h11.4" />
        <path d="M6.6 12V8.6M9.6 12V8.6M12.6 12V8.6" />
        <path d="M14 12c3.2.1 5.3-1.6 5.5-4M14 12c3.2-.1 5.3 1.6 5.5 4" />
        <path d="M19.5 8v8" />
      </>
    ),
  },
  play: {
    paths: (
      <path d="M8.7 5.9v12.2c0 .9 1 1.5 1.8 1l9.8-6.1c.7-.5.7-1.5 0-2L10.5 4.9c-.8-.5-1.8.1-1.8 1Z" />
    ),
    solid: true,
  },
  stop: {
    paths: <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="1.6" />,
    solid: true,
  },
  metro: {
    paths: (
      <>
        <path d="M9.4 3.4h5.2l3 15.3a1.7 1.7 0 0 1-1.7 2H8.1a1.7 1.7 0 0 1-1.7-2L9.4 3.4Z" />
        <path d="M12 15.8l3.4-10.6" />
      </>
    ),
    accents: <circle cx="15.9" cy="3.8" r="1.15" />,
  },
  loop: {
    paths: (
      <>
        <path d="M4 10V9a3 3 0 0 1 3-3h12.2M16.4 3.2 19.2 6l-2.8 2.8" />
        <path d="M20 14v1a3 3 0 0 1-3 3H4.8M7.6 20.8 4.8 18l2.8-2.8" />
      </>
    ),
  },
  gear: {
    paths: (
      <>
        <circle cx="12" cy="12" r="3.1" />
        <path d="M12 3.6V8M12 16v4.4M20.4 12H16M8 12H3.6M17.7 6.3l-2.9 2.9M9.2 14.8l-2.9 2.9M17.7 17.7l-2.9-2.9M9.2 9.2 6.3 6.3" />
      </>
    ),
  },
  folder: {
    paths: (
      <path d="M3.2 7A1.8 1.8 0 0 1 5 5.2h4.1l2 2.3H19a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8V7Z" />
    ),
  },
  note: {
    paths: <path d="M9.4 17.8V6.2l9.4-2v11.4" />,
    accents: (
      <>
        <circle cx="7.2" cy="17.8" r="2.2" />
        <circle cx="16.6" cy="15.6" r="2.2" />
      </>
    ),
  },
  trash: {
    paths: (
      <>
        <path d="M4.5 6.6h15" />
        <path d="M9.7 6.6V5.2a1.4 1.4 0 0 1 1.4-1.4h1.8a1.4 1.4 0 0 1 1.4 1.4v1.4" />
        <path d="M6.4 6.6l.7 12.2a1.6 1.6 0 0 0 1.6 1.5h6.6a1.6 1.6 0 0 0 1.6-1.5l.7-12.2" />
        <path d="M10.1 10.4v5.8M13.9 10.4v5.8" />
      </>
    ),
  },
  phones: {
    paths: <path d="M4 14.6v-2.2a8 8 0 0 1 16 0v2.2" />,
    accents: (
      <>
        <rect x="3.2" y="13.6" width="4" height="6.2" rx="1.8" />
        <rect x="16.8" y="13.6" width="4" height="6.2" rx="1.8" />
      </>
    ),
  },
  palette: {
    paths: (
      <path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.3 0 2.1-.8 2.1-1.9 0-1.2-1.1-1.7-1.1-2.7 0-.9.7-1.5 1.8-1.5h1.6c2.4 0 4.2-1.7 4.2-4.1 0-3.9-3.9-7-8.6-7Z" />
    ),
    accents: (
      <>
        <circle cx="7.6" cy="10.4" r="1" />
        <circle cx="11.2" cy="7.4" r="1" />
        <circle cx="15.4" cy="8.6" r="1" />
      </>
    ),
  },
}
