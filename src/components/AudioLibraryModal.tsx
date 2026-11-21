import { useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { StoredAudioFileMeta } from '../types/storedFile'
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
    // 安全区：加到主屏后刘海/主屏指示器不压弹窗（浏览器模式 env()=0 即 24px）
    paddingTop: 'max(24px, env(safe-area-inset-top))',
    paddingRight: 'max(24px, env(safe-area-inset-right))',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(24px, env(safe-area-inset-left))',
    '@media (max-width: 639px)': {
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
    },
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'var(--color-backdrop)',
  },
  dialog: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '460px',
    maxWidth: '100%',
    // 矮屏/长历史（phone-compat P7）：高度钳在遮罩内容盒内，历史区内滚，
    // 标题与关闭钮始终可达
    maxHeight: '100%',
    borderRadius: 'var(--radius-pop)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-surface-2)',
    padding: '22px',
    boxShadow: 'var(--shadow-pop)',
    '@media (max-width: 639px)': {
      padding: '18px',
    },
  },
  headRow: {
    marginBottom: '16px',
    display: 'flex',
    flexShrink: 0,
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
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
        color: 'var(--color-fg)',
      },
    },
    // 触控（phone-compat P10）：关闭钮 30px 补到命中线
    '@media (pointer: coarse)': {
      height: '38px',
      width: '38px',
    },
  },
  dropzone: {
    flexShrink: 0,
    cursor: 'pointer',
    borderRadius: 'var(--radius-card)',
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    paddingInline: '16px',
    paddingBottom: '22px',
    paddingTop: '26px',
    textAlign: 'center',
    '@media (max-width: 639px)': {
      paddingBottom: '16px',
      paddingTop: '18px',
    },
  },
  dropzoneIdle: {
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 4%, transparent)',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-verm-soft)',
      },
    },
  },
  dropzoneActive: {
    borderColor: 'var(--color-verm)',
    backgroundColor: 'var(--color-verm-soft)',
  },
  dropzoneBusy: {
    cursor: 'progress',
    opacity: 0.6,
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
  errorBanner: {
    marginTop: '12px',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'baseline',
    gap: '8px',
    borderRadius: '10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-clay-line)',
    backgroundColor: 'var(--color-clay-soft)',
    paddingInline: '12px',
    paddingBlock: '9px',
    fontSize: '12.5px',
    lineHeight: '18px',
    color: 'var(--color-clay)',
  },
  recentSection: {
    marginTop: '16px',
    // 弹窗内唯一可伸缩段：内容少时按内容高，超出遮罩时收缩并内滚
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
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
    flexShrink: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
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
    // 键盘加速提示只给精确指针设备（触屏走 ✕ / 点遮罩关闭）
    '@media (pointer: coarse)': {
      display: 'none',
    },
  },
})

interface AudioLibraryModalProps {
  open: boolean
  onClose: () => void
  /** IndexedDB 音频历史（uploadedAt 降序，元信息投影） */
  items: StoredAudioFileMeta[]
  /** 当前装载中的音频（列表高亮；null = 空态） */
  activeId: string | null
  /** 正在转存入库（多选逐个完成，期间禁再入） */
  importing: boolean
  /** 导入错误提示（已 i18n 化；null = 无错误） */
  errorText: string | null
  onFilesSelected: (files: FileList | null) => void
  onSelectItem: (id: string) => void
  onDeleteItem: (id: string) => void
}

/** 音频库弹窗（原曲页，FileLoaderModal 同构）：多选拖放/点选入库 + IndexedDB 音频历史切换 */
export default function AudioLibraryModal({
  open,
  onClose,
  items,
  activeId,
  importing,
  errorText,
  onFilesSelected,
  onSelectItem,
  onDeleteItem,
}: AudioLibraryModalProps) {
  const { t } = useI18n()
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

  const historyItems: FileHistoryItem[] = items.map(({ id, fileName, fileSize, uploadedAt }) => ({
    id,
    title: fileName,
    fileSize,
    uploadedAt,
  }))

  return (
    <div {...stylex.props(styles.overlay)} onClick={onClose}>
      <div aria-hidden {...stylex.props(styles.backdrop)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.audioLibraryTitle}
        onClick={(event) => event.stopPropagation()}
        {...stylex.props(styles.dialog)}
      >
        <div {...stylex.props(styles.headRow)}>
          <h3 {...stylex.props(styles.title)}>
            <span aria-hidden {...stylex.props(styles.titleIcon)}>
              <ThemeIcon name="phones" style={styles.icon15} />
            </span>
            {t.audioLibraryTitle}
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
          aria-busy={importing || undefined}
          onClick={() => {
            if (!importing) inputRef.current?.click()
          }}
          onKeyDown={(event) => {
            if (!importing && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click()
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!importing) setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragActive(false)
            if (!importing) onFilesSelected(event.dataTransfer.files)
          }}
          data-drag-active={dragActive || undefined}
          {...stylex.props(
            styles.dropzone,
            dragActive ? styles.dropzoneActive : styles.dropzoneIdle,
            importing && styles.dropzoneBusy,
          )}
        >
          <div aria-hidden {...stylex.props(styles.iconWrap)}>
            <ThemeIcon name="phones" style={styles.icon30} />
          </div>
          <div {...stylex.props(styles.dropMain)}>
            {importing ? t.importingAudio : (
              <>
                {t.audioDropMain} <em {...stylex.props(styles.browseEm)}>{t.dropBrowse}</em>
              </>
            )}
          </div>
          <div {...stylex.props(styles.dropHint)}>{t.audioDropHint}</div>
        </div>
        {/* multiple：多选/多文件投放逐个过白名单入库，活动音频取最后一个（docs/audio.md §5.1） */}
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,audio/*"
          multiple
          onChange={(event) => {
            onFilesSelected(event.target.files)
            event.target.value = ''
          }}
          {...stylex.props(styles.hiddenInput)}
          aria-hidden="true"
          tabIndex={-1}
        />

        {errorText !== null && (
          <p role="alert" {...stylex.props(styles.errorBanner)}>
            <span aria-hidden>⚠</span>
            {errorText}
          </p>
        )}

        <div {...stylex.props(styles.recentSection)}>
          <h4 {...stylex.props(styles.recentHead)}>
            <span>{t.recentAudio}</span>
            <span {...stylex.props(styles.recentCount)}>{items.length}</span>
          </h4>
          {historyItems.length > 0 ? (
            <FileHistoryList
              items={historyItems}
              icon="phones"
              activeId={activeId}
              onSelect={onSelectItem}
              onDelete={onDeleteItem}
            />
          ) : (
            <p {...stylex.props(styles.recentEmpty)}>{t.audioRecentEmpty}</p>
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
