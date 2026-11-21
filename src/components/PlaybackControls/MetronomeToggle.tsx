import { useEffect, useState, type CSSProperties } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ThemeIcon } from '../icons/ThemeIcon'
import { ctlLabel } from './styles'
import { useClickOutside } from '../../hooks/useClickOutside'
import { clampTransform, usePopoverClamp } from '../../hooks/usePopoverClamp'
import { useI18n } from '../../locales/useI18n'
import { METRONOME_SOUND_TYPES, type MetronomeSoundType } from '../../types/audio'

/** 设置弹层宽度（钳制计算与样式共用） */
const SETTINGS_POP_WIDTH = 248

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

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  anchor: {
    position: 'relative',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: 'var(--radius-btn)',
    paddingInline: '14px',
    paddingBlock: '8px',
    fontSize: '13px',
    fontWeight: 600,
    // 触控（phone-compat P10）：开关钮 ≈38px 高，触屏补到 44pt 命中线
    '@media (pointer: coarse)': {
      paddingBlock: '11px',
    },
  },
  toggleOn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'var(--color-verm-soft)',
    color: 'var(--color-verm-deep)',
  },
  toggleOff: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-fg-2)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
      },
    },
  },
  icon16: {
    height: '16px',
    width: '16px',
  },
  icon17: {
    height: '17px',
    width: '17px',
  },
  gearBtn: {
    display: 'grid',
    height: '34px',
    width: '34px',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '9px',
    fontSize: '15px',
    // 触控专项（PRD G12）：齿轮钮触屏加大到 44pt 命中线
    '@media (pointer: coarse)': {
      height: '44px',
      width: '44px',
    },
  },
  gearOn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'var(--color-verm-soft)',
    color: 'var(--color-verm-deep)',
  },
  gearOff: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    color: 'var(--color-fg-2)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
        color: 'var(--color-fg)',
      },
    },
  },
  settingsPop: {
    position: 'absolute',
    bottom: 'calc(100% + 10px)',
    right: 0,
    zIndex: 30,
    width: `${SETTINGS_POP_WIDTH}px`,
    // 手机窄屏/矮屏（phone-compat P3）：宽高钳到视口内、超高内滚
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100dvh - 140px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-surface-2)',
    padding: '16px',
    boxShadow: 'var(--shadow-pop)',
  },
  section: {
    marginBottom: '12px',
  },
  sectionLabel: {
    marginBottom: '7px',
    fontSize: '11.5px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    color: 'var(--color-fg-3)',
  },
  soundRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  soundBtn: {
    // 按内容伸缩：长音色名（法语 Électronique/Grosse caisse）自动折到第二行而非溢出
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    borderRadius: '8px',
    borderWidth: 1,
    borderStyle: 'solid',
    paddingInline: '4px',
    paddingBlock: '6px',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    // 触控专项（PRD G12）：音色四选一触屏加高
    '@media (pointer: coarse)': {
      paddingBlock: '11px',
    },
  },
  soundOn: {
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'var(--color-verm-soft)',
    color: 'var(--color-verm-deep)',
  },
  soundOff: {
    borderColor: 'var(--color-line)',
    backgroundColor: 'transparent',
    color: 'var(--color-fg-2)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
      },
    },
  },
  volHead: {
    marginBottom: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '11.5px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    color: 'var(--color-fg-3)',
  },
  volValue: {
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-verm-deep)',
  },
})

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
      <div {...stylex.props(styles.volHead)}>
        <span>{label}</span>
        <b {...stylex.props(styles.volValue)}>{percent}%</b>
      </div>
      <input
        type="range"
        className="tt-range"
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
  const offsetX = usePopoverClamp(settingsRef, settingsOpen, SETTINGS_POP_WIDTH)

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
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(ctlLabel.base)}>{t.metronomeLabel}</span>
      <div {...stylex.props(styles.controls)}>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          {...stylex.props(styles.toggleBtn, on ? styles.toggleOn : styles.toggleOff)}
        >
          <ThemeIcon name="metro" style={styles.icon16} />
          {on ? t.metronomeOn : t.metronomeOff}
        </button>
        <div {...stylex.props(styles.anchor)} ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={t.metronomeSettings}
            aria-expanded={settingsOpen}
            {...stylex.props(styles.gearBtn, on ? styles.gearOn : styles.gearOff)}
          >
            <ThemeIcon name="gear" style={styles.icon17} />
          </button>
          {settingsOpen && (
            <div
              data-settings-popover=""
              {...stylex.props(styles.settingsPop)}
              style={clampTransform(offsetX)}
            >
              <div {...stylex.props(styles.section)}>
                <div {...stylex.props(styles.sectionLabel)}>{t.soundName}</div>
                <div {...stylex.props(styles.soundRow)}>
                  {METRONOME_SOUND_TYPES.map((soundType) => (
                    <button
                      key={soundType}
                      type="button"
                      onClick={() => onSoundChange(soundType)}
                      aria-pressed={sound === soundType}
                      {...stylex.props(styles.soundBtn, sound === soundType ? styles.soundOn : styles.soundOff)}
                    >
                      {soundLabels[soundType]}
                    </button>
                  ))}
                </div>
              </div>
              <div {...stylex.props(styles.section)}>
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
