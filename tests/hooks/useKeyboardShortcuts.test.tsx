import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function Fixture({
  onPlayToggle,
  onStop,
  onEscape,
  enabled,
}: {
  onPlayToggle: () => void
  onStop: () => void
  onEscape?: () => void
  enabled?: boolean
}) {
  useKeyboardShortcuts({ onPlayToggle, onStop, onEscape, enabled })
  return <div data-testid="stage" />
}

describe('useKeyboardShortcuts', () => {
  it('Space 触发播放切换并阻止默认行为', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    render(<Fixture onPlayToggle={onPlayToggle} onStop={onStop} />)

    // preventDefault 会令 dispatchEvent 返回 false
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(onPlayToggle).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('Escape 触发停止且不触发播放切换', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    render(<Fixture onPlayToggle={onPlayToggle} onStop={onStop} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onPlayToggle).not.toHaveBeenCalled()
  })

  it('提供 onEscape 时 Esc 走停止并清除路径（tech.md §6.3）', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    const onEscape = vi.fn()
    render(<Fixture onPlayToggle={onPlayToggle} onStop={onStop} onEscape={onEscape} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('输入类元素聚焦时忽略快捷键', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    const { getByRole } = render(
      <>
        <input aria-label="text" />
        <Fixture onPlayToggle={onPlayToggle} onStop={onStop} />
      </>,
    )

    const input = getByRole('textbox')
    input.focus()
    fireEvent.keyDown(input, { code: 'Space' })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onPlayToggle).not.toHaveBeenCalled()
    expect(onStop).not.toHaveBeenCalled()
  })

  it('contentEditable 元素聚焦时忽略快捷键', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    const { getByTestId } = render(
      <>
        <div data-testid="editor" />
        <Fixture onPlayToggle={onPlayToggle} onStop={onStop} />
      </>,
    )

    // jsdom 不实现 contentEditable，手动标记为可编辑元素
    const editor = getByTestId('editor')
    Object.defineProperty(editor, 'isContentEditable', { value: true, configurable: true })
    fireEvent.keyDown(editor, { code: 'Space' })

    expect(onPlayToggle).not.toHaveBeenCalled()
  })

  it('enabled=false 时整体停用', () => {
    const onPlayToggle = vi.fn()
    const onStop = vi.fn()
    const { rerender } = render(
      <Fixture onPlayToggle={onPlayToggle} onStop={onStop} enabled={false} />,
    )

    fireEvent.keyDown(window, { code: 'Space' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onPlayToggle).not.toHaveBeenCalled()
    expect(onStop).not.toHaveBeenCalled()

    rerender(<Fixture onPlayToggle={onPlayToggle} onStop={onStop} enabled />)
    fireEvent.keyDown(window, { code: 'Space' })
    expect(onPlayToggle).toHaveBeenCalledTimes(1)
  })
})
