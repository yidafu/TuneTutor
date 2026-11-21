import * as stylex from '@stylexjs/stylex'
import { ThemeIcon } from '../icons/ThemeIcon'
import { useI18n } from '../../locales/useI18n'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  playBtn: {
    position: 'relative',
    display: 'grid',
    height: '46px',
    width: '46px',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: 9999,
    backgroundImage: 'linear-gradient(to bottom right, var(--color-gold-bright), var(--color-gold))',
    fontSize: '15px',
    color: 'var(--color-cream)',
    boxShadow: 'var(--shadow-btn-gold)',
    '@media (hover: hover)': {
      ':hover': {
        filter: 'brightness(1.05)',
      },
    },
  },
  pulseRing: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    borderRadius: 9999,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'var(--color-gold-bright)',
    animationName: 'pulse-ring',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-out',
    animationIterationCount: 'infinite',
  },
  playIconWrap: {
    position: 'relative',
  },
  icon22: {
    height: '22px',
    width: '22px',
  },
})

interface TransportButtonsProps {
  playing: boolean
  onPlayToggle: () => void
}

/**
 * 走带按钮。单按钮切换：停止态显示 ▶，播放中转金铜脉冲并显示 ⏹
 * （L2：语义如实为「停止」，真暂停/续播见 PRD G1）。
 */
export default function TransportButtons({ playing, onPlayToggle }: TransportButtonsProps) {
  const { t } = useI18n()

  return (
    <div {...stylex.props(styles.row)}>
      <button
        type="button"
        onClick={onPlayToggle}
        title={playing ? t.stop : t.play}
        aria-label={playing ? t.stop : t.play}
        aria-pressed={playing}
        {...stylex.props(styles.playBtn)}
      >
        {playing && (
          <span aria-hidden {...stylex.props(styles.pulseRing)} />
        )}
        <span aria-hidden {...stylex.props(styles.playIconWrap)}>
          <ThemeIcon name={playing ? 'stop' : 'play'} style={styles.icon22} />
        </span>
      </button>
    </div>
  )
}
