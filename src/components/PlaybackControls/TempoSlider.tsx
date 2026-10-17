import type { CSSProperties } from 'react'
import { useI18n } from '../../locales/useI18n'

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

  return (
    <div className="flex items-center gap-3">
      <span className="ctl-label">{t.tempoLabel}</span>
      <div className="flex min-w-[180px] flex-1 items-center gap-3">
        <input
          type="range"
          className="tt-range min-w-0 flex-1"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          aria-label={t.tempoLabel}
          style={{ '--fill': `${fillPercent}%` } as CSSProperties}
        />
        <div className="flex min-w-[74px] items-baseline gap-1">
          <span className="text-[22px] font-bold tabular-nums tracking-[-0.5px]">{value}</span>
          <span className="text-[11px] font-semibold text-fg-3">{t.bpmUnit}</span>
        </div>
      </div>
    </div>
  )
}
