import { useI18n } from '../locales/useI18n'

/**
 * 选择信息行。选择模型（docs/selection.md）尚未接入，当前为未选择空态；
 * 接入后此处显示乐句/小节范围 chip（朱砂）+「清除选择」按钮。
 */
export default function SelectionInfo() {
  const { t } = useI18n()

  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
      <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-3 px-[13px] py-[7px] text-[13px] font-semibold text-fg-2">
        <span aria-hidden className="h-2 w-2 rounded-full bg-ink-2" />
        {t.selectionNone}
      </span>
      <span className="text-xs text-fg-3">{t.selectionHint}</span>
    </div>
  )
}
