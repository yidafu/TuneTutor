import * as stylex from '@stylexjs/stylex'
import { ctlLabel } from './styles'
import { useI18n } from '../../locales/useI18n'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  beatGroup: {
    display: 'flex',
    gap: '3px',
    '@media (pointer: coarse)': {
      gap: '5px',
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
    ':hover': {
      backgroundColor: 'var(--color-surface-3)',
      color: 'var(--color-fg)',
    },
  },
  info: {
    minWidth: '52px',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
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
      <span {...stylex.props(ctlLabel.base)}>{t.skipLabel}</span>
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
