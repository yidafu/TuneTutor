import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../locales/useI18n'

const styles = stylex.create({
  stage: {
    marginTop: '8px',
    display: 'grid',
    minHeight: '160px',
    flex: 1,
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-wash)',
    paddingInline: '24px',
  },
  placeholder: {
    maxWidth: '420px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--color-fg-3)',
  },
  footer: {
    marginTop: '14px',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    paddingTop: '10px',
    fontSize: '11.5px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-ink-2)',
  },
  zoomRow: {
    display: 'inline-flex',
    gap: '4px',
  },
  zoomChip: {
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-3)',
    paddingInline: '8px',
    paddingBlock: '2px',
    color: 'var(--color-fg-2)',
  },
})

/**
 * 纸面乐谱卡渲染区 + 页脚。OSMD 集成（docs/tech.md §6.1）尚未接入，
 * 目前渲染占位空态；接入后此组件持有 OSMD 容器与选择/乐句覆盖层。
 */
export default function OsmdNotation() {
  const { t } = useI18n()

  return (
    <>
      <div {...stylex.props(styles.stage)}>
        <p {...stylex.props(styles.placeholder)}>{t.notationPlaceholder}</p>
      </div>
      <div {...stylex.props(styles.footer)}>
        <span>{t.notationFootInfo}</span>
        <span {...stylex.props(styles.zoomRow)} aria-hidden="true">
          <span {...stylex.props(styles.zoomChip)}>－</span>
          <span {...stylex.props(styles.zoomChip)}>100%</span>
          <span {...stylex.props(styles.zoomChip)}>＋</span>
        </span>
      </div>
    </>
  )
}
