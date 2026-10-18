import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FileLoaderModal from '@/components/FileLoaderModal'
import type { FileHistoryItem } from '@/components/FileLoader/FileHistoryList'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

const ITEMS: FileHistoryItem[] = [
  { id: 'a', title: 'Sonata.musicxml', fileSize: 1024, uploadedAt: Date.now() },
  { id: 'b', title: '刻在我心底的名字.musicxml', fileSize: 2 * 1024 * 1024, uploadedAt: Date.now() - 60_000 },
]

interface RenderOptions {
  items?: FileHistoryItem[]
  importing?: boolean
  errorText?: string | null
}

function renderModal(options: RenderOptions = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    items: options.items ?? ITEMS,
    importing: options.importing ?? false,
    errorText: options.errorText ?? null,
    onFilesSelected: vi.fn(),
    onSelectItem: vi.fn(),
    onDeleteItem: vi.fn(),
  }
  renderWithProviders(<FileLoaderModal {...props} />)
  return props
}

describe('FileLoaderModal', () => {
  it('open=false 不渲染任何内容', () => {
    renderWithProviders(
      <FileLoaderModal
        open={false}
        onClose={() => {}}
        items={[]}
        importing={false}
        errorText={null}
        onFilesSelected={() => {}}
        onSelectItem={() => {}}
        onDeleteItem={() => {}}
      />,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('open=true 渲染对话框：标题、上传区、最近文件计数与隐藏 input', () => {
    const props = renderModal()

    const dialog = screen.getByRole('dialog', { name: enUS.loadScoreTitle })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(enUS.recentFiles)).toBeInTheDocument()
    expect(within(dialog).getByText(String(ITEMS.length))).toBeInTheDocument()
    expect(within(dialog).getByText(enUS.dropHint)).toBeInTheDocument()
    const input = dialog.ownerDocument.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', '.musicxml,.xml,.mxl')

    // 历史条目渲染 + 删除回调带 id
    expect(within(dialog).getByText('Sonata.musicxml')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: `${enUS.delete} Sonata.musicxml` }))
    expect(props.onDeleteItem).toHaveBeenCalledWith('a')
  })

  it('点击历史条目标题回调 onSelectItem(id)', () => {
    const props = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刻在我心底的名字.musicxml' }))

    expect(props.onSelectItem).toHaveBeenCalledWith('b')
  })

  it('Esc 关闭', () => {
    const props = renderModal()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('✕ 按钮与点遮罩关闭；点对话框内部不关闭', () => {
    const props = renderModal()
    const dialog = screen.getByRole('dialog')

    fireEvent.click(dialog)
    expect(props.onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: enUS.closeHint }))
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(dialog.parentElement!)
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('上传区键盘操作（Enter / Space）触发文件选择', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    const dropzone = within(dialog).getByText(enUS.dropMain).closest('[role="button"]')!
    const input = dialog.ownerDocument.querySelector<HTMLElement>('input[type="file"]')!
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.keyDown(dropzone, { key: 'Enter' })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(dropzone, { key: ' ' })
    expect(clickSpy).toHaveBeenCalledTimes(2)

    clickSpy.mockRestore()
  })

  it('选择文件回调 onFilesSelected（input change 与 drop 两个入口）', () => {
    const props = renderModal()
    const dialog = screen.getByRole('dialog')
    const dropzone = within(dialog).getByText(enUS.dropMain).closest('[role="button"]')!
    const input = dialog.ownerDocument.querySelector('input[type="file"]')!
    const file = new File(['<score-partwise/>'], 'a.musicxml', { type: 'text/xml' })

    fireEvent.change(input, { target: { files: [file] } })
    expect(props.onFilesSelected).toHaveBeenCalledTimes(1)

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(props.onFilesSelected).toHaveBeenCalledTimes(2)
  })

  it('解析中：提示 importing 文案、aria-busy，且键盘不触发选择', () => {
    renderModal({ importing: true })
    const dialog = screen.getByRole('dialog')
    const dropzone = within(dialog).getByText(enUS.importing).closest('[role="button"]')!
    const input = dialog.ownerDocument.querySelector<HTMLElement>('input[type="file"]')!
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    expect(dropzone).toHaveAttribute('aria-busy', 'true')

    fireEvent.keyDown(dropzone, { key: 'Enter' })
    expect(clickSpy).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('错误提示横幅（role=alert）', () => {
    renderModal({ errorText: enUS.errorCorruptArchive })

    expect(screen.getByRole('alert')).toHaveTextContent(enUS.errorCorruptArchive)
  })

  it('空历史渲染空态文案', () => {
    renderModal({ items: [] })

    expect(screen.getByText(enUS.recentEmpty)).toBeInTheDocument()
  })

  it('拖拽悬停切换高亮态（dragActive 样式态切换）', () => {
    renderModal()
    const dropzone = screen.getByText(enUS.dropMain).closest('[role="button"]')!
    const idleClassName = dropzone.className

    expect(dropzone).not.toHaveAttribute('data-drag-active')
    expect(idleClassName).not.toBe('')

    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveAttribute('data-drag-active', 'true')
    expect(dropzone.className).not.toBe(idleClassName)

    fireEvent.dragLeave(dropzone)
    expect(dropzone).not.toHaveAttribute('data-drag-active')
    expect(dropzone.className).toBe(idleClassName)
  })
})
