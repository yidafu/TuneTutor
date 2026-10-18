import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AudioLibraryModal from '@/components/AudioLibraryModal'
import type { StoredAudioFileMeta } from '@/types/storedFile'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

// 图标是叶子组件、有自己的专属测试；这里只断言页面传给它的名字
vi.mock('@/components/icons/ThemeIcon', () => ({
  ThemeIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}))

const ITEMS: StoredAudioFileMeta[] = [
  { id: 'a', fileName: 'song.mp3', fileSize: 1024, uploadedAt: Date.now() },
  { id: 'b', fileName: '练习.wav', fileSize: 2 * 1024 * 1024, uploadedAt: Date.now() - 60_000 },
]

interface RenderOptions {
  items?: StoredAudioFileMeta[]
  activeId?: string | null
  importing?: boolean
  errorText?: string | null
}

function renderModal(options: RenderOptions = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    items: options.items ?? ITEMS,
    activeId: options.activeId ?? null,
    importing: options.importing ?? false,
    errorText: options.errorText ?? null,
    onFilesSelected: vi.fn(),
    onSelectItem: vi.fn(),
    onDeleteItem: vi.fn(),
  }
  renderWithProviders(<AudioLibraryModal {...props} />)
  return props
}

describe('AudioLibraryModal', () => {
  it('open=false 不渲染任何内容', () => {
    renderWithProviders(
      <AudioLibraryModal
        open={false}
        onClose={() => {}}
        items={[]}
        activeId={null}
        importing={false}
        errorText={null}
        onFilesSelected={() => {}}
        onSelectItem={() => {}}
        onDeleteItem={() => {}}
      />,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('open=true 渲染对话框：标题、上传区（音频 accept + multiple）、最近音频计数', () => {
    const props = renderModal({ activeId: 'a' })

    const dialog = screen.getByRole('dialog', { name: enUS.audioLibraryTitle })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(enUS.recentAudio)).toBeInTheDocument()
    expect(within(dialog).getByText(String(ITEMS.length))).toBeInTheDocument()
    expect(within(dialog).getByText(enUS.audioDropHint)).toBeInTheDocument()
    const input = dialog.ownerDocument.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', '.mp3,.wav,.ogg,.m4a,audio/*')
    expect(input).toHaveAttribute('multiple')

    // 条目用音频图标渲染；删除回调带 id
    expect(within(dialog).getAllByTestId('icon-phones').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('song.mp3')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: `${enUS.delete} song.mp3` }))
    expect(props.onDeleteItem).toHaveBeenCalledWith('a')
  })

  it('当前装载条目高亮（data-active），其余不高亮', () => {
    renderModal({ activeId: 'b' })
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByText('练习.wav').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(within(dialog).getByText('song.mp3').closest('[data-active]')).toBeNull()
  })

  it('点击条目标题回调 onSelectItem(id)', () => {
    const props = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '练习.wav' }))

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
    const dropzone = within(dialog).getByText(enUS.audioDropMain).closest('[role="button"]')!
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
    const dropzone = within(dialog).getByText(enUS.audioDropMain).closest('[role="button"]')!
    const input = dialog.ownerDocument.querySelector('input[type="file"]')!
    const file = new File([new Uint8Array([1])], 'a.mp3', { type: 'audio/mpeg' })

    fireEvent.change(input, { target: { files: [file] } })
    expect(props.onFilesSelected).toHaveBeenCalledTimes(1)

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(props.onFilesSelected).toHaveBeenCalledTimes(2)
  })

  it('导入中：提示 importingAudio 文案、aria-busy，且键盘不触发选择', () => {
    renderModal({ importing: true })
    const dialog = screen.getByRole('dialog')
    const dropzone = within(dialog).getByText(enUS.importingAudio).closest('[role="button"]')!
    const input = dialog.ownerDocument.querySelector<HTMLElement>('input[type="file"]')!
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    expect(dropzone).toHaveAttribute('aria-busy', 'true')

    fireEvent.keyDown(dropzone, { key: 'Enter' })
    expect(clickSpy).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('错误提示横幅（role=alert）', () => {
    renderModal({ errorText: enUS.errorUnsupportedAudio })

    expect(screen.getByRole('alert')).toHaveTextContent(enUS.errorUnsupportedAudio)
  })

  it('空历史渲染空态文案', () => {
    renderModal({ items: [] })

    expect(screen.getByText(enUS.audioRecentEmpty)).toBeInTheDocument()
  })

  it('拖拽悬停切换高亮态（dragActive 样式态切换）', () => {
    renderModal()
    const dropzone = screen.getByText(enUS.audioDropMain).closest('[role="button"]')!
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
