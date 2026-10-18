import type { Language } from '../../locales/languages'
import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../../locales/useI18n'
import { ThemeIcon } from '../icons/ThemeIcon'

const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    borderRadius: 'var(--radius-btn)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    paddingInline: '11px',
    paddingBlock: '9px',
    ':hover': {
      borderColor: 'var(--color-line)',
      backgroundColor: 'var(--color-surface-3)',
    },
  },
  iconBox: {
    display: 'grid',
    height: '34px',
    width: '34px',
    flex: 'none',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '9px',
    backgroundColor: 'var(--color-surface-3)',
    boxShadow: 'inset 0 0 0 1px var(--color-line)',
  },
  icon15: {
    height: '15px',
    width: '15px',
  },
  textCol: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderWidth: 0,
    paddingInline: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-fg)',
    textAlign: 'left',
    ':hover': {
      color: 'var(--color-verm-deep)',
    },
  },
  meta: {
    marginTop: '1px',
    display: 'block',
    fontSize: '11.5px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-fg-3)',
  },
  deleteBtn: {
    display: 'grid',
    height: '28px',
    width: '28px',
    flex: 'none',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '8px',
    color: 'var(--color-fg-3)',
    ':hover': {
      backgroundColor: 'var(--color-clay-soft)',
      color: 'var(--color-clay)',
    },
  },
})

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
  /** 点击条目载入该乐谱 */
  onSelect?: (id: string) => void
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

/** 加载弹窗内的最近文件列表（悬停显示删除；点击标题载入） */
export default function FileHistoryList({ items, onDelete, onSelect }: FileHistoryListProps) {
  const { t, language } = useI18n()

  return (
    <div {...stylex.props(styles.list)}>
      {items.map((item) => (
        <div key={item.id} {...stylex.props(styles.row)}>
          <span aria-hidden {...stylex.props(styles.iconBox)}>
            <ThemeIcon name="note" style={styles.icon15} />
          </span>
          <span {...stylex.props(styles.textCol)}>
            <button
              type="button"
              onClick={onSelect === undefined ? undefined : () => onSelect(item.id)}
              {...stylex.props(styles.title)}
            >
              {item.title}
            </button>
            <span {...stylex.props(styles.meta)}>
              {formatFileSize(item.fileSize)} · {formatRelativeTime(item.uploadedAt, language)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title={t.delete}
            aria-label={`${t.delete} ${item.title}`}
            {...stylex.props(styles.deleteBtn)}
          >
            <ThemeIcon name="trash" style={styles.icon15} />
          </button>
        </div>
      ))}
    </div>
  )
}
