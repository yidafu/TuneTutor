import * as stylex from '@stylexjs/stylex'

/**
 * 播放控制条共享样式：控制项小标签（原 index.css .ctl-label，
 * TempoSlider / MetronomeToggle / LoopSkipSelector 三处共用）。
 */
export const ctlLabel = stylex.create({
  base: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-fg-3)',
    letterSpacing: '1.2px',
    whiteSpace: 'nowrap',
  },
})
