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
    '@media (max-width: 639px)': {
      marginTop: '10px',
    },
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
  /**
   * 常规操作提示手机隐藏（phone-compat P6）：窄屏折 3–4 行，且「空白拖拽框选」
   * 在手机默认滚动模式下不成立。无效选择的反馈（hintInvalid）始终显示。
   */
  hintIdle: {
    '@media (max-width: 639px)': {
      display: 'none',
    },
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
    '@media (hover: hover)': {
      ':hover': {
        borderColor: 'var(--color-verm-line-strong)',
        color: 'var(--color-verm-deep)',
      },
    },
    // 触控（phone-compat P10）：≈33px 高补到命中线
    '@media (pointer: coarse)': {
      paddingBlock: '10px',
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
      <span {...stylex.props(styles.hint, invalid ? styles.hintInvalid : styles.hintIdle)}>
        {invalid ? t.selectionInvalid : t.selectionHint}
      </span>
    </div>
  )
}
