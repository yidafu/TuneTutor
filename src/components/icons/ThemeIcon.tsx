import { useTheme } from '../../hooks/useTheme'
import type { InstrumentType } from '../../types/audio'
import { ICON_GEOMETRY, type ThemeIconName } from './geometry'
import { THEME_ICON_STYLES } from './styles'

/**
 * 主题图标渲染器：读当前皮肤，按该皮肤的笔触（THEME_ICON_STYLES）渲染
 * v1.2 定稿几何（ICON_GEOMETRY），换肤时随 Provider 状态整体重渲染，
 * 得到每主题观感不同的一套图标。颜色一律 currentColor，随所在文字的 token。
 */
export function ThemeIcon({ name, className }: { name: ThemeIconName; className?: string }) {
  const { theme } = useTheme()
  const style = THEME_ICON_STYLES[theme]
  const geometry = ICON_GEOMETRY[name]

  return (
    <svg
      viewBox="0 0 24 24"
      fill={geometry.solid ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={style.strokeWidth}
      strokeLinecap={style.linecap}
      strokeLinejoin={style.linejoin}
      aria-hidden="true"
      className={className}
    >
      {geometry.paths}
      {geometry.accents &&
        (style.accents === 'fill' ? (
          <g fill="currentColor" stroke="none">
            {geometry.accents}
          </g>
        ) : (
          <g>{geometry.accents}</g>
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
  className,
}: {
  instrument: InstrumentType
  className?: string
}) {
  return <ThemeIcon name={INSTRUMENT_ICONS[instrument]} className={className} />
}
