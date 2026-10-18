import { useEffect, useState, type CSSProperties } from 'react'
import { ThemeIcon } from '../icons/ThemeIcon'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useI18n } from '../../locales/useI18n'
import { METRONOME_SOUND_TYPES, type MetronomeSoundType } from '../../types/audio'

interface MetronomeToggleProps {
  on: boolean
  onToggle: () => void
  sound: MetronomeSoundType
  onSoundChange: (sound: MetronomeSoundType) => void
  strongVolume: number
  onStrongVolumeChange: (volume: number) => void
  weakVolume: number
  onWeakVolumeChange: (volume: number) => void
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (volume: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div>
      <div className="mb-[7px] flex items-center justify-between text-[11.5px] font-semibold tracking-[0.4px] text-fg-3">
        <span>{label}</span>
        <b className="tabular-nums text-verm-deep">{percent}%</b>
      </div>
      <input
        type="range"
        className="tt-range w-full"
        data-tone="verm"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
        aria-label={label}
        style={{ '--fill': `${percent}%` } as CSSProperties}
      />
    </div>
  )
}

/** 节拍器开关 + 齿轮设置弹层（音色四选一、强/弱拍音量），点外部或 Esc 关闭（PRD F8） */
export default function MetronomeToggle({
  on,
  onToggle,
  sound,
  onSoundChange,
  strongVolume,
  onStrongVolumeChange,
  weakVolume,
  onWeakVolumeChange,
}: MetronomeToggleProps) {
  const { t } = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useClickOutside<HTMLDivElement>(() => setSettingsOpen(false))

  useEffect(() => {
    if (!settingsOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen])

  const soundLabels: Record<MetronomeSoundType, string> = {
    classic: t.metroSoundClassic,
    digital: t.metroSoundDigital,
    kick: t.metroSoundKick,
    click: t.metroSoundClick,
  }

  return (
    <div className="flex items-center gap-3">
      <span className="ctl-label">{t.metronomeLabel}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-btn px-[14px] py-2 text-[13px] font-semibold transition ${
            on
              ? 'border border-verm-line-strong bg-verm-soft text-verm-deep'
              : 'border border-line-strong bg-surface-2 text-fg-2 hover:bg-surface-3'
          }`}
        >
          <ThemeIcon name="metro" className="h-4 w-4" />
          {on ? t.metronomeOn : t.metronomeOff}
        </button>
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={t.metronomeSettings}
            aria-expanded={settingsOpen}
            className={`grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-[9px] border bg-surface-2 text-[15px] transition ${
              on
                ? 'border-verm-line-strong bg-verm-soft text-verm-deep'
                : 'border-line-strong text-fg-2 hover:bg-surface-3 hover:text-fg'
            }`}
          >
            <ThemeIcon name="gear" className="h-[17px] w-[17px]" />
          </button>
          {settingsOpen && (
            <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 w-[248px] rounded-card border border-line-strong bg-surface-2 p-4 shadow-pop">
              <div className="mb-3">
                <div className="mb-[7px] text-[11.5px] font-semibold tracking-[0.4px] text-fg-3">
                  {t.soundName}
                </div>
                <div className="flex gap-1">
                  {METRONOME_SOUND_TYPES.map((soundType) => (
                    <button
                      key={soundType}
                      type="button"
                      onClick={() => onSoundChange(soundType)}
                      aria-pressed={sound === soundType}
                      className={`flex-1 cursor-pointer rounded-[8px] border px-1 py-[6px] text-xs font-medium transition ${
                        sound === soundType
                          ? 'border-verm-line-strong bg-verm-soft text-verm-deep'
                          : 'border-line bg-transparent text-fg-2 hover:bg-surface-3'
                      }`}
                    >
                      {soundLabels[soundType]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <VolumeSlider label={t.strongVolume} value={strongVolume} onChange={onStrongVolumeChange} />
              </div>
              <VolumeSlider label={t.weakVolume} value={weakVolume} onChange={onWeakVolumeChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
