import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../locales/useI18n'

const styles = stylex.create({
  root: {
    marginTop: '14px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-surface-3)',
    paddingInline: '13px',
    paddingBlock: '7px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-fg-2)',
  },
  dot: {
    height: '8px',
    width: '8px',
    borderRadius: 9999,
    backgroundColor: 'var(--color-ink-2)',
  },
  hint: {
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
  },
})

/**
 * 选择信息行。选择模型（docs/selection.md）尚未接入，当前为未选择空态；
 * 接入后此处显示乐句/小节范围 chip（朱砂）+「清除选择」按钮。
 */
export default function SelectionInfo() {
  const { t } = useI18n()

  return (
    <div {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.chip)}>
        <span aria-hidden {...stylex.props(styles.dot)} />
        {t.selectionNone}
      </span>
      <span {...stylex.props(styles.hint)}>{t.selectionHint}</span>
    </div>
  )
}
