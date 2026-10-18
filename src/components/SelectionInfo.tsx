import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../locales/useI18n'
import { describeSelection, type SelectionSummary } from '../utils/notation/selection'

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
    fontVariantNumeric: 'tabular-nums',
  },
  chipActive: {
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 7%, var(--color-surface-3))',
    color: 'var(--color-verm-deep)',
  },
  dot: {
    height: '8px',
    width: '8px',
    borderRadius: 9999,
    backgroundColor: 'var(--color-ink-2)',
  },
  dotActive: {
    backgroundColor: 'var(--color-verm)',
  },
  hint: {
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
  },
  hintInvalid: {
    color: 'var(--color-verm-deep)',
  },
  clearBtn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    borderRadius: 'var(--radius-btn)',
    backgroundColor: 'transparent',
    paddingInline: '12px',
    paddingBlock: '6px',
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--color-fg-2)',
    cursor: 'pointer',
    ':hover': {
      borderColor: 'var(--color-verm-line-strong)',
      color: 'var(--color-verm-deep)',
    },
  },
})

interface SelectionInfoProps {
  /** 当前选择摘要；null = 未选择空态 */
  selection: SelectionSummary | null
  /** 最近一次选择无法落成有效区间（selection.md §2.3 解析失败的 UI 提示） */
  invalid: boolean
  onClear: () => void
}

/**
 * 选择信息行（ui-design.html v3）：未选择 = 灰 chip + 操作提示；
 * 已选择 = 朱砂 chip（乐句/小节/框选 · 小节范围 · 音符数）+ 清除按钮。
 */
export default function SelectionInfo({ selection, invalid, onClear }: SelectionInfoProps) {
  const { t } = useI18n()

  return (
    <div {...stylex.props(styles.root)}>
      {selection === null ? (
        <span {...stylex.props(styles.chip)}>
          <span aria-hidden {...stylex.props(styles.dot)} />
          {t.selectionNone}
        </span>
      ) : (
        <>
          <span {...stylex.props(styles.chip, styles.chipActive)}>
            <span aria-hidden {...stylex.props(styles.dot, styles.dotActive)} />
            {describeSelection(t, selection)}
          </span>
          <button type="button" {...stylex.props(styles.clearBtn)} onClick={onClear}>
            {t.selectionClear}
          </button>
        </>
      )}
      <span {...stylex.props(styles.hint, invalid && styles.hintInvalid)}>
        {invalid ? t.selectionInvalid : t.selectionHint}
      </span>
    </div>
  )
}
