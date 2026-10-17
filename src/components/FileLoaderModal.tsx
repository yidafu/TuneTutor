import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../locales/useI18n'
import FileHistoryList, { type FileHistoryItem } from './FileLoader/FileHistoryList'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div aria-hidden className="absolute inset-0 bg-backdrop" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.loadScoreTitle}
        onClick={(event) => event.stopPropagation()}
        className="relative w-[460px] max-w-full rounded-pop border border-line-strong bg-surface-2 p-[22px] shadow-pop"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 flex items-center gap-[9px] text-base font-bold">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-[8px] bg-[rgb(36_31_21/0.06)] text-sm shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              📂
            </span>
            {t.loadScoreTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeHint}
            className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[8px] border border-line bg-transparent text-fg-3 transition hover:bg-surface-3 hover:text-fg"
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
          className={`cursor-pointer rounded-card border-[1.5px] border-dashed px-4 pb-[22px] pt-[26px] text-center transition ${
            dragActive
              ? 'border-verm bg-verm-soft'
              : 'border-verm-line-strong bg-verm/[0.04] hover:bg-verm-soft'
          }`}
        >
          <div aria-hidden className="text-[30px]">🎼</div>
          <div className="mt-2 text-[13.5px] font-semibold text-fg">
            {t.dropMain} <em className="not-italic text-verm-deep">{t.dropBrowse}</em>
          </div>
          <div className="mt-[3px] text-xs text-fg-3">{t.dropHint}</div>
        </div>
        {/* 解析入库（processFile/musicxml-io）尚未接入；选择文件暂不产生效果 */}
        <input
          ref={inputRef}
          type="file"
          accept=".musicxml,.xml,.mxl"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="mt-4">
          <h4 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-[0.5px] text-fg-3">
            <span>{t.recentFiles}</span>
            <span className="font-medium">{items.length}</span>
          </h4>
          {items.length > 0 ? (
            <FileHistoryList
              items={items}
              onDelete={(id) => setItems((list) => list.filter((item) => item.id !== id))}
            />
          ) : (
            <p className="py-3 text-center text-xs text-fg-3">{t.recentEmpty}</p>
          )}
        </div>

        <div className="mt-[15px] flex items-center justify-between border-t border-line pt-[13px] text-[11.5px] text-fg-3">
          <span>{t.localNote}</span>
          <span className="inline-flex items-center gap-[5px]">
            <kbd className="inline-block min-w-[22px] rounded-[7px] border border-line-strong border-b-[2.5px] bg-surface-2 px-[9px] py-[3px] text-center text-xs font-semibold text-fg">
              Esc
            </kbd>
            {t.closeHint}
          </span>
        </div>
      </div>
    </div>
  )
}
