import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useClickOutside } from '../hooks/useClickOutside'
import { useI18n } from '../locales/useI18n'
import { INSTRUMENT_TYPES, type InstrumentType } from '../types/audio'
import { instrumentLabel } from './instrumentMeta'
import { menuItem, menuPop } from './menu.styles'
import { InstrumentGlyph } from './icons/ThemeIcon'

const styles = stylex.create({
  anchor: {
    position: 'relative',
  },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    paddingInline: '13px',
    paddingBlock: '8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    borderRadius: 'var(--radius-btn)',
    backgroundColor: 'var(--color-surface-2)',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-fg)',
    ':hover': {
      backgroundColor: 'var(--color-surface-3)',
    },
    // 触控专项（PRD G12）：触屏触发钮命中面加大
    '@media (pointer: coarse)': {
      paddingBlock: '11px',
    },
  },
  glyph15: {
    height: '15px',
    width: '15px',
  },
  chevron: {
    fontSize: '10px',
    color: 'var(--color-fg-3)',
  },
  triggerDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    ':hover': {
      backgroundColor: 'var(--color-surface-2)',
    },
  },
  option: {
    gap: '8px',
  },
  optionSelected: {
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  optionIdle: {
    color: 'var(--color-fg-2)',
  },
  optionName: {
    flex: 1,
  },
  checkMark: {
    color: 'var(--color-verm-deep)',
  },
})

interface InstrumentSelectProps {
  value: InstrumentType
  onChange: (instrument: InstrumentType) => void
  /** 播放中禁用（乐器切换仅停止态，docs/audio.md §3.6） */
  disabled?: boolean
}

/** 乐器音色选择器（7 种采样，仅停止态可换——播放中由调用方以 disabled 约束） */
export default function InstrumentSelect({ value, onChange, disabled = false }: InstrumentSelectProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div {...stylex.props(styles.anchor)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...stylex.props(styles.trigger, disabled && styles.triggerDisabled)}
      >
        <InstrumentGlyph instrument={value} style={styles.glyph15} />
        {instrumentLabel(t, value)}
        <span aria-hidden {...stylex.props(styles.chevron)}>▼</span>
      </button>
      {open && (
        <ul
          role="listbox"
          {...stylex.props(menuPop.base)}
        >
          {INSTRUMENT_TYPES.map((instrument) => (
            <li key={instrument}>
              <button
                type="button"
                role="option"
                aria-selected={instrument === value}
                onClick={() => {
                  onChange(instrument)
                  setOpen(false)
                }}
                {...stylex.props(
                  menuItem.base,
                  styles.option,
                  instrument === value ? styles.optionSelected : styles.optionIdle,
                )}
              >
                <InstrumentGlyph instrument={instrument} style={styles.glyph15} />
                <span {...stylex.props(styles.optionName)}>{instrumentLabel(t, instrument)}</span>
                {instrument === value && (
                  <span aria-hidden {...stylex.props(styles.checkMark)}>✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
