import * as stylex from '@stylexjs/stylex'
import { ctlLabel } from './styles'
import { useI18n } from '../../locales/useI18n'

const styles = stylex.create({
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    // 手机竖屏（phone-compat P5）：独占控制条一整行，网格化为
    // 「标签 · 状态」一行 + 8 键等分一行；键宽随可用宽伸缩（360 视口亦不溢出）
    '@media (max-width: 639px)': {
      display: 'grid',
      flexBasis: '100%',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gridTemplateAreas: '"label info" "beats beats"',
      columnGap: '12px',
      rowGap: '6px',
    },
  },
  label: {
    '@media (max-width: 639px)': {
      gridArea: 'label',
    },
  },
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    '@media (max-width: 639px)': {
      display: 'contents',
    },
  },
  beatGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
    '@media (pointer: coarse)': {
      gap: '5px',
    },
    '@media (max-width: 639px)': {
      display: 'grid',
      gridArea: 'beats',
      gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
      gap: '4px',
    },
  },
  beatBtn: {
    display: 'grid',
    height: '27px',
    width: '27px',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '8px',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    // 触控专项（PRD G12）：27px 远低于 Apple HIG 44pt 命中线，触屏加大到 36px
    '@media (pointer: coarse)': {
      height: '36px',
      width: '36px',
      fontSize: '13px',
    },
    // 手机：宽度交给网格等分（≥32px），高度保持触屏 36px
    '@media (max-width: 639px)': {
      width: 'auto',
      minWidth: 0,
    },
  },
  beatOn: {
    backgroundColor: 'var(--color-verm)',
    color: 'var(--color-cream)',
    boxShadow: 'var(--shadow-btn-beat)',
  },
  beatOff: {
    backgroundColor: 'transparent',
    color: 'var(--color-fg-2)',
    boxShadow: 'inset 0 0 0 1px var(--color-line-strong)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
        color: 'var(--color-fg)',
      },
    },
  },
  info: {
    minWidth: '52px',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
    '@media (max-width: 639px)': {
      gridArea: 'info',
      minWidth: 0,
      textAlign: 'end',
    },
  },
  infoValue: {
    fontWeight: 600,
    color: 'var(--color-verm-deep)',
  },
})

const SKIP_BEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const

interface LoopSkipSelectorProps {
  value: number
  /** 点击当前值归零；否则设为点击的拍数 */
  onChange: (beats: number) => void
}

/** 空拍（循环跳过）选择器：1–8 拍轮间静音，再次点击当前值归零（PRD F7） */
export default function LoopSkipSelector({ value, onChange }: LoopSkipSelectorProps) {
  const { t } = useI18n()

  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(ctlLabel.base, styles.label)}>{t.skipLabel}</span>
      <div {...stylex.props(styles.group)}>
        <div {...stylex.props(styles.beatGroup)} role="group" aria-label={t.skipLabel}>
          {SKIP_BEAT_OPTIONS.map((beats) => (
            <button
              key={beats}
              type="button"
              onClick={() => onChange(value === beats ? 0 : beats)}
              aria-pressed={value === beats}
              title={String(beats)}
              {...stylex.props(styles.beatBtn, value === beats ? styles.beatOn : styles.beatOff)}
            >
              {beats}
            </button>
          ))}
        </div>
        <span {...stylex.props(styles.info)}>
          {value > 0 ? (
            <b {...stylex.props(styles.infoValue)}>{t.skipPerLoop(value)}</b>
          ) : (
            t.skipOff
          )}
        </span>
      </div>
    </div>
  )
}
