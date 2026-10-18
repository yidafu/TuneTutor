import { useI18n } from '../locales/useI18n'

/**
 * 纸面乐谱卡渲染区 + 页脚。OSMD 集成（docs/tech.md §6.1）尚未接入，
 * 目前渲染占位空态；接入后此组件持有 OSMD 容器与选择/乐句覆盖层。
 */
export default function OsmdNotation() {
  const { t } = useI18n()

  return (
    <>
      <div className="mt-2 grid min-h-[160px] flex-1 place-items-center rounded-card border border-dashed border-line-strong bg-wash px-6">
        <p className="max-w-[420px] text-center text-[13px] text-fg-3">{t.notationPlaceholder}</p>
      </div>
      <div className="mt-3.5 flex shrink-0 items-center justify-between border-t border-line pt-2.5 text-[11.5px] tabular-nums text-ink-2">
        <span>{t.notationFootInfo}</span>
        <span className="inline-flex gap-1" aria-hidden="true">
          <span className="rounded-[6px] bg-surface-3 px-2 py-[2px] text-fg-2">－</span>
          <span className="rounded-[6px] bg-surface-3 px-2 py-[2px] text-fg-2">100%</span>
          <span className="rounded-[6px] bg-surface-3 px-2 py-[2px] text-fg-2">＋</span>
        </span>
      </div>
    </>
  )
}
