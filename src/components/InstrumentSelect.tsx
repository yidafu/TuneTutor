import { useState } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import { useI18n } from '../locales/useI18n'
import { INSTRUMENT_TYPES, type InstrumentType } from '../types/audio'
import { instrumentLabel, INSTRUMENT_EMOJI } from './instrumentMeta'

interface InstrumentSelectProps {
  value: InstrumentType
  onChange: (instrument: InstrumentType) => void
}

/** 乐器音色选择器（7 种采样，仅停止态可换——引擎接入后由调用方约束） */
export default function InstrumentSelect({ value, onChange }: InstrumentSelectProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-line-strong bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-fg transition hover:bg-surface-3"
      >
        <span aria-hidden>{INSTRUMENT_EMOJI[value]}</span>
        {instrumentLabel(t, value)}
        <span aria-hidden className="text-[10px] text-fg-3">▼</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-44 overflow-hidden rounded-btn border border-line-strong bg-surface-2 py-1 shadow-pop"
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
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-surface-3 ${
                  instrument === value ? 'font-semibold text-fg' : 'text-fg-2'
                }`}
              >
                <span aria-hidden>{INSTRUMENT_EMOJI[instrument]}</span>
                <span className="flex-1">{instrumentLabel(t, instrument)}</span>
                {instrument === value && (
                  <span aria-hidden className="text-verm-deep">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
