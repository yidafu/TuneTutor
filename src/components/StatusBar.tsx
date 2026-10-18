import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../locales/useI18n'
import type { InstrumentType } from '../types/audio'
import { instrumentLabel } from './instrumentMeta'
import { InstrumentGlyph, ThemeIcon } from './icons/ThemeIcon'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '10px',
    rowGap: '8px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    backgroundColor: 'var(--color-surface-3)',
    paddingInline: '16px',
    paddingBlock: '9px',
    fontSize: '12.5px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-fg-2)',
    '@media (min-width: 640px)': {
      paddingInline: '22px',
    },
  },
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: '18px',
    rowGap: '8px',
  },
  cell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
  },
  muted: {
    color: 'var(--color-fg-3)',
  },
  strong: {
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  selected: {
    color: 'var(--color-verm-deep)',
  },
  glyph15: {
    marginRight: '4px',
    display: 'inline-flex',
    height: '15px',
    width: '15px',
    verticalAlign: '-2px',
  },
  loopIcon: {
    height: '13px',
    width: '13px',
  },
  playing: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
    color: 'var(--color-moss)',
  },
  blinkDot: {
    height: '7px',
    width: '7px',
    borderRadius: 9999,
    backgroundColor: 'var(--color-moss)',
    boxShadow: '0 0 6px color-mix(in srgb, var(--color-moss) 60%, transparent)',
    animationName: 'blink',
    animationDuration: '1.4s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  noteGlyph: {
    color: 'var(--color-fg-3)',
  },
})

interface StatusBarProps {
  playing: boolean
  skipBeats: number
  instrument: InstrumentType
  tempo: number
  /** 当前选择摘要文案；缺省显示「未选择」 */
  selectionText?: string
}

/** 状态栏：左侧选择 / 空拍 / 乐器，右侧播放状态与共享 BPM（ui-design.html v3） */
export default function StatusBar({ playing, skipBeats, instrument, tempo, selectionText }: StatusBarProps) {
  const { t } = useI18n()

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.group)}>
        <span {...stylex.props(styles.cell)}>
          <span {...stylex.props(styles.muted)}>{t.statusSelection}</span>
          <b {...stylex.props(styles.strong, selectionText !== undefined && styles.selected)}>
            {selectionText ?? t.selectionNone}
          </b>
        </span>
        <span {...stylex.props(styles.cell)}>
          <span {...stylex.props(styles.cell, styles.muted)}>
            <ThemeIcon name="loop" style={styles.loopIcon} />
            {t.statusSkip}
          </span>
          <b {...stylex.props(styles.strong)}>
            {skipBeats > 0 ? t.skipBeatsShort(skipBeats) : t.skipOff}
          </b>
        </span>
        <span {...stylex.props(styles.cell)}>
          <span {...stylex.props(styles.muted)}>{t.statusInstrument}</span>
          <b {...stylex.props(styles.strong)}>
            <InstrumentGlyph instrument={instrument} style={styles.glyph15} />
            {instrumentLabel(t, instrument)}
          </b>
        </span>
      </div>
      <div {...stylex.props(styles.group)}>
        {playing ? (
          <span {...stylex.props(styles.playing)}>
            <span aria-hidden {...stylex.props(styles.blinkDot)} />
            {t.statusPlaying}
          </span>
        ) : (
          <span {...stylex.props(styles.muted)}>{t.statusStopped}</span>
        )}
        <span {...stylex.props(styles.cell)}>
          <span aria-hidden {...stylex.props(styles.noteGlyph)}>♩</span>
          <b {...stylex.props(styles.strong)}>{tempo} {t.bpmUnit}</b>
        </span>
      </div>
    </div>
  )
}
