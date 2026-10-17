import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useClickOutside } from '@/hooks/useClickOutside'

function Fixture({ onOutside }: { onOutside: () => void }) {
  const ref = useClickOutside<HTMLDivElement>(onOutside)
  return (
    <div>
      <div ref={ref} data-testid="inside">inside</div>
      <button type="button" data-testid="outside">outside</button>
    </div>
  )
}

describe('useClickOutside', () => {
  it('点击容器外部触发回调', () => {
    const onOutside = vi.fn()
    const { getByTestId } = render(<Fixture onOutside={onOutside} />)

    fireEvent.mouseDown(getByTestId('outside'))

    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  it('点击容器内部不触发回调', () => {
    const onOutside = vi.fn()
    const { getByTestId } = render(<Fixture onOutside={onOutside} />)

    fireEvent.mouseDown(getByTestId('inside'))

    expect(onOutside).not.toHaveBeenCalled()
  })

  it('卸载后移除 document 监听', () => {
    const onOutside = vi.fn()
    const { getByTestId, unmount } = render(<Fixture onOutside={onOutside} />)
    const outside = getByTestId('outside')
    unmount()

    fireEvent.mouseDown(outside)

    expect(onOutside).not.toHaveBeenCalled()
  })

  it('回调变化后使用最新引用（effect 随依赖重挂）', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { getByTestId, rerender } = render(<Fixture onOutside={first} />)
    rerender(<Fixture onOutside={second} />)

    fireEvent.mouseDown(getByTestId('outside'))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
