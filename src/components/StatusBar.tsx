import { instrumentLabel, INSTRUMENT_EMOJI } from './instrumentMeta'
import { useI18n } from '../locales/useI18n'
import type { InstrumentType } from '../types/audio'

interface StatusBarProps {
  playing: boolean
  skipBeats: number
  instrument: InstrumentType
  tempo: number
}

/** 状态栏：左侧选择 / 空拍 / 乐器，右侧播放状态与共享 BPM（ui-design.html v3） */
export default function StatusBar({ playing, skipBeats, instrument, tempo }: StatusBarProps) {
  const { t } = useI18n()

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2.5 gap-y-2 border-t border-line bg-surface-3 px-4 py-[9px] text-[12.5px] tabular-nums text-fg-2 sm:px-[22px]">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        <span className="inline-flex items-center gap-[7px]">
          <span className="text-fg-3">{t.statusSelection}</span>
          <b className="font-semibold text-fg">{t.selectionNone}</b>
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="text-fg-3">🔁 {t.statusSkip}</span>
          <b className="font-semibold text-fg">
            {skipBeats > 0 ? t.skipBeatsShort(skipBeats) : t.skipOff}
          </b>
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="text-fg-3">{t.statusInstrument}</span>
          <b className="font-semibold text-fg">
            {INSTRUMENT_EMOJI[instrument]} {instrumentLabel(t, instrument)}
          </b>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        {playing ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-moss">
            <span
              aria-hidden
              className="h-[7px] w-[7px] animate-blink rounded-full bg-moss shadow-[0_0_6px_rgb(71_118_79/0.8)]"
            />
            {t.statusPlaying}
          </span>
        ) : (
          <span className="text-fg-3">{t.statusStopped}</span>
        )}
        <span className="inline-flex items-center gap-[7px]">
          <span aria-hidden className="text-fg-3">♩</span>
          <b className="font-semibold text-fg">{tempo} {t.bpmUnit}</b>
        </span>
      </div>
    </div>
  )
}
