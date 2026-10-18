import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FileLoaderModal from '@/components/FileLoaderModal'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

function renderModal(open = true, onClose = vi.fn()) {
  renderWithProviders(<FileLoaderModal open={open} onClose={onClose} />)
  return onClose
}

describe('FileLoaderModal', () => {
  it('open=false 不渲染任何内容', () => {
    renderModal(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('open=true 渲染对话框：标题、上传区、最近文件计数', () => {
    renderModal(true)

    const dialog = screen.getByRole('dialog', { name: enUS.loadScoreTitle })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(enUS.recentFiles)).toBeInTheDocument()
    // 演示历史 3 条
    expect(within(dialog).getByText('3')).toBeInTheDocument()
    expect(within(dialog).getByText(enUS.dropHint)).toBeInTheDocument()
    // 隐藏 file input，接受三种扩展名
    const input = dialog.ownerDocument.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    expect(input).toHaveAttribute('accept', '.musicxml,.xml,.mxl')
  })

  it('Esc 关闭', () => {
    const onClose = renderModal(true)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('✕ 按钮与点遮罩关闭；点对话框内部不关闭', () => {
    const onClose = renderModal(true)
    const dialog = screen.getByRole('dialog')

    // 内部点击（对话框容器上 stopPropagation）
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: enUS.closeHint }))
    expect(onClose).toHaveBeenCalledTimes(1)

    // 遮罩 = fixed 容器自身（backdrop 是 aria-hidden 兄弟层，点击落在容器上）
    fireEvent.click(screen.getByText(enUS.dropMain).closest('div[role="dialog"]')!.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('上传区键盘操作（Enter / Space）触发文件选择', () => {
    renderModal(true)
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

  it('拖拽悬停切换高亮态（dragActive 样式态切换）', () => {
    renderModal(true)
    const dropzone = screen.getByText(enUS.dropMain).closest('[role="button"]')!
    // StyleX 原子类名不透明：记录空态类串，断言悬停时换态、离开后还原
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

  it('删除最近文件条目并更新计数', () => {
    renderModal(true)

    fireEvent.click(screen.getByRole('button', { name: `${enUS.delete} 刻在我心底的名字` }))

    expect(screen.queryByText('刻在我心底的名字')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
