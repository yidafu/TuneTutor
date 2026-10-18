import { useI18n } from '../../locales/useI18n'
import { ThemeIcon } from '../icons/ThemeIcon'

interface TransportButtonsProps {
  playing: boolean
  onPlayToggle: () => void
  onStop: () => void
}

/**
 * 走带按钮。播放中主按钮转金铜脉冲并显示 ⏹（L2：语义如实为「停止」，
 * 真暂停/续播见 PRD G1）；副按钮常驻停止。
 */
export default function TransportButtons({ playing, onPlayToggle, onStop }: TransportButtonsProps) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onPlayToggle}
        title={playing ? t.stop : t.play}
        aria-label={playing ? t.stop : t.play}
        aria-pressed={playing}
        className="relative grid h-[46px] w-[46px] cursor-pointer place-items-center rounded-full border-0 bg-gradient-to-br from-gold-bright to-gold text-[15px] text-cream shadow-btn-gold transition hover:brightness-105"
      >
        {playing && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full border-2 border-gold-bright"
          />
        )}
        <span aria-hidden className="relative">
          <ThemeIcon name={playing ? 'stop' : 'play'} className="h-5 w-5" />
        </span>
      </button>
      <button
        type="button"
        onClick={onStop}
        title={t.stop}
        aria-label={t.stop}
        className="grid h-[46px] w-[46px] cursor-pointer place-items-center rounded-full border-0 bg-surface-2 text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition hover:bg-surface-3 hover:text-fg"
      >
        <ThemeIcon name="stop" className="h-5 w-5" />
      </button>
    </div>
  )
}
