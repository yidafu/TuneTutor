import { useI18n } from '../../locales/useI18n'

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
    <div className="flex items-center gap-3">
      <span className="ctl-label">{t.skipLabel}</span>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[3px]" role="group" aria-label={t.skipLabel}>
          {SKIP_BEAT_OPTIONS.map((beats) => (
            <button
              key={beats}
              type="button"
              onClick={() => onChange(value === beats ? 0 : beats)}
              aria-pressed={value === beats}
              title={String(beats)}
              className={`grid h-[27px] w-[27px] cursor-pointer place-items-center rounded-[8px] border-0 text-xs font-semibold tabular-nums transition ${
                value === beats
                  ? 'bg-verm text-cream shadow-btn-beat'
                  : 'bg-transparent text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-surface-3 hover:text-fg'
              }`}
            >
              {beats}
            </button>
          ))}
        </div>
        <span className="min-w-[52px] text-xs text-fg-3">
          {value > 0 ? (
            <b className="font-semibold text-verm-deep">{t.skipPerLoop(value)}</b>
          ) : (
            t.skipOff
          )}
        </span>
      </div>
    </div>
  )
}
