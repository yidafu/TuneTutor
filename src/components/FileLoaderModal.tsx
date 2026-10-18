import { useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useI18n } from '../locales/useI18n'
import { ThemeIcon } from './icons/ThemeIcon'
import FileHistoryList, { type FileHistoryItem } from './FileLoader/FileHistoryList'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'var(--color-backdrop)',
  },
  dialog: {
    position: 'relative',
    width: '460px',
    maxWidth: '100%',
    borderRadius: 'var(--radius-pop)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-surface-2)',
    padding: '22px',
    boxShadow: 'var(--shadow-pop)',
  },
  headRow: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 700,
  },
  titleIcon: {
    display: 'grid',
    height: '28px',
    width: '28px',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '8px',
    backgroundColor: 'var(--color-wash)',
    boxShadow: 'inset 0 0 0 1px var(--color-line)',
  },
  icon15: {
    height: '15px',
    width: '15px',
  },
  icon30: {
    height: '30px',
    width: '30px',
  },
  closeBtn: {
    display: 'grid',
    height: '30px',
    width: '30px',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line)',
    color: 'var(--color-fg-3)',
    ':hover': {
      backgroundColor: 'var(--color-surface-3)',
      color: 'var(--color-fg)',
    },
  },
  dropzone: {
    cursor: 'pointer',
    borderRadius: 'var(--radius-card)',
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    paddingInline: '16px',
    paddingBottom: '22px',
    paddingTop: '26px',
    textAlign: 'center',
  },
  dropzoneIdle: {
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 4%, transparent)',
    ':hover': {
      backgroundColor: 'var(--color-verm-soft)',
    },
  },
  dropzoneActive: {
    borderColor: 'var(--color-verm)',
    backgroundColor: 'var(--color-verm-soft)',
  },
  iconWrap: {
    display: 'grid',
    alignItems: 'center',
    justifyItems: 'center',
  },
  dropMain: {
    marginTop: '8px',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  browseEm: {
    fontStyle: 'normal',
    color: 'var(--color-verm-deep)',
  },
  dropHint: {
    marginTop: '3px',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
  },
  hiddenInput: {
    display: 'none',
  },
  recentSection: {
    marginTop: '16px',
  },
  recentHead: {
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--color-fg-3)',
  },
  recentCount: {
    fontWeight: 500,
  },
  recentEmpty: {
    paddingBlock: '12px',
    textAlign: 'center',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
  },
  footRow: {
    marginTop: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    paddingTop: '13px',
    fontSize: '11.5px',
    color: 'var(--color-fg-3)',
  },
  kbdEsc: {
    display: 'inline-block',
    minWidth: '22px',
    borderRadius: '7px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    borderBottomWidth: '2.5px',
    backgroundColor: 'var(--color-surface-2)',
    paddingInline: '9px',
    paddingBlock: '3px',
    textAlign: 'center',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  closeHint: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  },
})

interface FileLoaderModalProps {
  open: boolean
  onClose: () => void
}

/** 演示用历史条目；接入 IndexedDB（docs/tech.md §7）后由存储层提供 */
const DEMO_HISTORY: FileHistoryItem[] = [
  { id: 'demo-1', title: '刻在我心底的名字', fileSize: 2.2 * 1024 * 1024, uploadedAt: Date.now() - 2 * 3_600_000 },
  { id: 'demo-2', title: '连音符', fileSize: 840 * 1024, uploadedAt: Date.now() - 26 * 3_600_000 },
  { id: 'demo-3', title: '小星星', fileSize: 120 * 1024, uploadedAt: Date.now() - 3 * 86_400_000 },
]

/** 加载乐谱弹窗：拖放/点选上传区 + 最近文件；Esc / 点遮罩 / ✕ 关闭 */
export default function FileLoaderModal({ open, onClose }: FileLoaderModalProps) {
  const { t } = useI18n()
  const [items, setItems] = useState<FileHistoryItem[]>(DEMO_HISTORY)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div {...stylex.props(styles.overlay)} onClick={onClose}>
      <div aria-hidden {...stylex.props(styles.backdrop)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.loadScoreTitle}
        onClick={(event) => event.stopPropagation()}
        {...stylex.props(styles.dialog)}
      >
        <div {...stylex.props(styles.headRow)}>
          <h3 {...stylex.props(styles.title)}>
            <span aria-hidden {...stylex.props(styles.titleIcon)}>
              <ThemeIcon name="folder" style={styles.icon15} />
            </span>
            {t.loadScoreTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeHint}
            {...stylex.props(styles.closeBtn)}
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragActive(false)
          }}
          data-drag-active={dragActive || undefined}
          {...stylex.props(styles.dropzone, dragActive ? styles.dropzoneActive : styles.dropzoneIdle)}
        >
          <div aria-hidden {...stylex.props(styles.iconWrap)}>
            <ThemeIcon name="note" style={styles.icon30} />
          </div>
          <div {...stylex.props(styles.dropMain)}>
            {t.dropMain} <em {...stylex.props(styles.browseEm)}>{t.dropBrowse}</em>
          </div>
          <div {...stylex.props(styles.dropHint)}>{t.dropHint}</div>
        </div>
        {/* 解析入库（processFile/musicxml-io）尚未接入；选择文件暂不产生效果 */}
        <input
          ref={inputRef}
          type="file"
          accept=".musicxml,.xml,.mxl"
          {...stylex.props(styles.hiddenInput)}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div {...stylex.props(styles.recentSection)}>
          <h4 {...stylex.props(styles.recentHead)}>
            <span>{t.recentFiles}</span>
            <span {...stylex.props(styles.recentCount)}>{items.length}</span>
          </h4>
          {items.length > 0 ? (
            <FileHistoryList
              items={items}
              onDelete={(id) => setItems((list) => list.filter((item) => item.id !== id))}
            />
          ) : (
            <p {...stylex.props(styles.recentEmpty)}>{t.recentEmpty}</p>
          )}
        </div>

        <div {...stylex.props(styles.footRow)}>
          <span>{t.localNote}</span>
          <span {...stylex.props(styles.closeHint)}>
            <kbd {...stylex.props(styles.kbdEsc)}>Esc</kbd>
            {t.closeHint}
          </span>
        </div>
      </div>
    </div>
  )
}
