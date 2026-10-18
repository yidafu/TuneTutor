import type { CSSProperties } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ctlLabel } from './styles'
import { useI18n } from '../../locales/useI18n'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sliderWrap: {
    display: 'flex',
    minWidth: '180px',
    flex: 1,
    alignItems: 'center',
    gap: '12px',
  },
  range: {
    minWidth: 0,
    flex: 1,
  },
  valueBox: {
    display: 'flex',
    minWidth: '74px',
    alignItems: 'baseline',
    gap: '4px',
  },
  value: {
    fontSize: '22px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.5px',
  },
  unit: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-fg-3)',
  },
})

export const TEMPO_MIN = 40
export const TEMPO_MAX = 240

interface TempoSliderProps {
  value: number
  onChange: (tempo: number) => void
  /** 原曲页速度为只读展示（docs/tech.md §2.3） */
  disabled?: boolean
}

/** 速度滑杆：40–240 BPM，数字大字展示 */
export default function TempoSlider({ value, onChange, disabled = false }: TempoSliderProps) {
  const { t } = useI18n()
  const fillPercent = ((value - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN)) * 100
  const range = stylex.props(styles.range)

  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(ctlLabel.base)}>{t.tempoLabel}</span>
      <div {...stylex.props(styles.sliderWrap)}>
        <input
          type="range"
          className={`tt-range ${range.className ?? ''}`}
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          aria-label={t.tempoLabel}
          style={{ '--fill': `${fillPercent}%` } as CSSProperties}
        />
        <div {...stylex.props(styles.valueBox)}>
          <span {...stylex.props(styles.value)}>{value}</span>
          <span {...stylex.props(styles.unit)}>{t.bpmUnit}</span>
        </div>
      </div>
    </div>
  )
}
