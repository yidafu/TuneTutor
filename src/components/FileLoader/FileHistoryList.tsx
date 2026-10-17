import type { Language } from '../../locales/languages'
import { useI18n } from '../../locales/useI18n'

/** 最近文件条目（stub：接入 IndexedDB 后由 utils/storage 返回同形数据） */
export interface FileHistoryItem {
  id: string
  title: string
  fileSize: number
  uploadedAt: number
}

interface FileHistoryListProps {
  items: FileHistoryItem[]
  onDelete: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatRelativeTime(timestamp: number, language: Language): string {
  const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const diffMinutes = Math.round((timestamp - Date.now()) / 60_000)
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, 'minute')
  const diffHours = Math.round((timestamp - Date.now()) / 3_600_000)
  if (Math.abs(diffHours) < 24) return relative.format(diffHours, 'hour')
  const diffDays = Math.round((timestamp - Date.now()) / 86_400_000)
  if (Math.abs(diffDays) < 7) return relative.format(diffDays, 'day')
  return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(timestamp)
}

/** 加载弹窗内的最近文件列表（悬停显示删除） */
export default function FileHistoryList({ items, onDelete }: FileHistoryListProps) {
  const { t, language } = useI18n()

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex cursor-pointer items-center gap-[11px] rounded-btn border border-transparent px-[11px] py-[9px] transition hover:border-line hover:bg-surface-3"
        >
          <span
            aria-hidden
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-surface-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-line)]"
          >
            🎵
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-fg">{item.title}</span>
            <span className="mt-px block text-[11.5px] tabular-nums text-fg-3">
              {formatFileSize(item.fileSize)} · {formatRelativeTime(item.uploadedAt, language)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title={t.delete}
            aria-label={`${t.delete} ${item.title}`}
            className="grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent text-fg-3 transition hover:bg-clay-soft hover:text-clay"
          >
            <span aria-hidden>🗑</span>
          </button>
        </div>
      ))}
    </div>
  )
}
