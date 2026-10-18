import { useTheme } from '../../hooks/useTheme'
import type { InstrumentType } from '../../types/audio'
import type { ThemeId } from '../../themes'
import type { StyleXStyles } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { ICON_GEOMETRY, type ThemeIconName } from './geometry'
import { THEME_ICON_STYLES } from './styles'
import { THEME_GLYPHS } from './themeGlyphs'

/**
 * 主题图标渲染器：读当前皮肤，按该皮肤的笔触（THEME_ICON_STYLES）渲染
 * v1.2 定稿几何（ICON_GEOMETRY），换肤时随 Provider 状态整体重渲染，
 * 得到每主题观感不同的一套图标。颜色一律 currentColor，随所在文字的 token。
 */
export function ThemeIcon({ name, style }: { name: ThemeIconName; style?: StyleXStyles }) {
  const { theme } = useTheme()
  const iconStyle = THEME_ICON_STYLES[theme]
  const geometry = ICON_GEOMETRY[name]

  return (
    <svg
      {...stylex.props(style)}
      viewBox="0 0 24 24"
      fill={geometry.solid ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={iconStyle.strokeWidth}
      strokeLinecap={iconStyle.linecap}
      strokeLinejoin={iconStyle.linejoin}
      aria-hidden="true"
    >
      {geometry.paths}
      {geometry.accents &&
        (iconStyle.accents === 'fill' ? (
          <g fill="currentColor" stroke="none">
            {geometry.accents}
          </g>
        ) : (
          <g>{geometry.accents}</g>
        ))}
    </svg>
  )
}

/**
 * 主题 identity 字形：themeId 指定画哪枚，笔触固定取「该主题自身」的
 * THEME_ICON_STYLES（与当前皮肤无关），弹层行内即预览该肤笔触语言。
 */
export function ThemeGlyph({ themeId, style }: { themeId: ThemeId; style?: StyleXStyles }) {
  const glyphStyle = THEME_ICON_STYLES[themeId]
  const glyph = THEME_GLYPHS[themeId]

  return (
    <svg
      {...stylex.props(style)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={glyphStyle.strokeWidth}
      strokeLinecap={glyphStyle.linecap}
      strokeLinejoin={glyphStyle.linejoin}
      aria-hidden="true"
    >
      {glyph.paths}
      {glyph.accents &&
        (glyphStyle.accents === 'fill' ? (
          <g fill="currentColor" stroke="none">
            {glyph.accents}
          </g>
        ) : (
          <g>{glyph.accents}</g>
        ))}
    </svg>
  )
}

const INSTRUMENT_ICONS: Record<InstrumentType, ThemeIconName> = {
  piano: 'piano',
  saxophone: 'sax',
  guitar: 'guitar',
  bass: 'bass',
  violin: 'violin',
  flute: 'flute',
  trumpet: 'trumpet',
}

/** 乐器字形：全部 SVG 化（v1.2 §①-02 全量替换清单，乐器 7 枚专形专绘） */
export function InstrumentGlyph({
  instrument,
  style,
}: {
  instrument: InstrumentType
  style?: StyleXStyles
}) {
  return <ThemeIcon name={INSTRUMENT_ICONS[instrument]} style={style} />
}
