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
  playBtnBusy: {
    opacity: 0.7,
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
  // 采样加载 spinner：按钮内原地图标位替换（浅色描边圈，index.css @keyframes spin）
  spinner: {
    height: '18px',
    width: '18px',
    borderRadius: 9999,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'var(--color-cream)',
    borderTopColor: 'transparent',
    animationName: 'spin',
    animationDuration: '0.9s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  loadChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--color-fg)',
    opacity: 0.75,
    whiteSpace: 'nowrap',
  },
  loadChipFailed: {
    color: 'var(--color-clay)',
    opacity: 1,
  },
  retryBtn: {
    height: '22px',
    paddingInline: '8px',
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-clay-line)',
    backgroundColor: 'var(--color-clay-soft)',
    fontSize: '12px',
    color: 'var(--color-clay)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-clay-line)',
      },
    },
  },
})

interface TransportButtonsProps {
  playing: boolean
  onPlayToggle: () => void
  /** 采样加载中：停止态禁用走带并显示 spinner/提示（就绪前音符被静默丢弃） */
  samplesLoading: boolean
  /** 采样加载失败：显示失败提示 + 重试按钮 */
  samplesFailed: boolean
  onRetrySamples: () => void
}

/**
 * 走带按钮。单按钮切换：停止态显示 ▶，播放中转金铜脉冲并显示 ⏹
 * （L2：语义如实为「停止」，真暂停/续播见 PRD G1）。
 * 采样加载窗口（首次钢琴预载 / 切乐器）：停止态按钮禁用并原地转 spinner，
 * 旁挂 role="status" 提示「音色加载中…」；失败态挂失败提示 + 重试（usePlayback 守卫
 * 同源拦截键盘走带，两路输入一致）。播放中不拦停止。
 */
export default function TransportButtons({
  playing,
  onPlayToggle,
  samplesLoading,
  samplesFailed,
  onRetrySamples,
}: TransportButtonsProps) {
  const { t } = useI18n()
  // 停止态且采样不可用（加载中/失败）时禁用走带；播放中永远可停
  const busy = !playing && (samplesLoading || samplesFailed)
  const showSpinner = !playing && samplesLoading && !samplesFailed

  return (
    <div {...stylex.props(styles.row)}>
      <button
        type="button"
        onClick={onPlayToggle}
        disabled={busy}
        title={playing ? t.stop : t.play}
        aria-label={playing ? t.stop : t.play}
        aria-pressed={playing}
        {...stylex.props(styles.playBtn, busy && styles.playBtnBusy)}
      >
        {playing && (
          <span aria-hidden {...stylex.props(styles.pulseRing)} />
        )}
        <span aria-hidden {...stylex.props(styles.playIconWrap)}>
          {showSpinner ? (
            <span {...stylex.props(styles.spinner)} />
          ) : (
            <ThemeIcon name={playing ? 'stop' : 'play'} style={styles.icon22} />
          )}
        </span>
      </button>
      {samplesFailed && !playing && (
        <span role="status" {...stylex.props(styles.loadChip, styles.loadChipFailed)}>
          {t.samplesFailed}
          <button type="button" onClick={onRetrySamples} {...stylex.props(styles.retryBtn)}>
            {t.retryLoad}
          </button>
        </span>
      )}
      {!samplesFailed && samplesLoading && (
        <span role="status" {...stylex.props(styles.loadChip)}>
          {t.samplesLoading}
        </span>
      )}
    </div>
  )
}
