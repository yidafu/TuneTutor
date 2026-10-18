import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDoubleTap, type DoubleTapOptions } from '@/hooks/useDoubleTap'

function Fixture({
  onDoubleTap,
  options,
}: {
  onDoubleTap: (event: PointerEvent) => void
  options?: DoubleTapOptions
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDoubleTap(ref, onDoubleTap, options)
  return (
    <div>
      <div ref={ref} data-testid="stage">stage</div>
      <button type="button" data-testid="elsewhere">elsewhere</button>
    </div>
  )
}

function tap(target: HTMLElement, x = 0): void {
  fireEvent.pointerDown(target, { isPrimary: true, clientX: x, clientY: 0 })
}

describe('useDoubleTap', () => {
  it('窗口内两次按下触发一次，回调收到第二次事件', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')

    tap(stage, 10)
    expect(onDoubleTap).not.toHaveBeenCalled()
    tap(stage, 10)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
    expect((onDoubleTap.mock.calls[0]![0] as PointerEvent).clientX).toBe(10)
  })

  it('超出时间窗（默认 400ms）不触发', () => {
    const clock = { now: 0 }
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(
      <Fixture onDoubleTap={onDoubleTap} options={{ now: () => clock.now }} />,
    )
    const stage = getByTestId('stage')

    tap(stage)
    clock.now = 401
    tap(stage)

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('窗口边界（恰为 delayMs）触发', () => {
    const clock = { now: 0 }
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(
      <Fixture onDoubleTap={onDoubleTap} options={{ now: () => clock.now }} />,
    )
    const stage = getByTestId('stage')

    tap(stage)
    clock.now = 400
    tap(stage)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
  })

  it('位移超过 slopPx（默认 24px）不触发', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')

    tap(stage, 0)
    tap(stage, 25)

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('位移恰为 slopPx 触发', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')

    tap(stage, 0)
    tap(stage, 24)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
  })

  it('两次按下之间点了容器外，节奏被打断不触发', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)

    tap(getByTestId('stage'))
    tap(getByTestId('elsewhere'))
    tap(getByTestId('stage'))

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('pointercancel 重置节奏（滚动/系统手势接管）', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')

    tap(stage)
    fireEvent.pointerCancel(stage)
    tap(stage)

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('非主指针（多指第二落点）不参与双击', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')

    fireEvent.pointerDown(stage, { isPrimary: false })
    fireEvent.pointerDown(stage, { isPrimary: false })

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('容器外的双击不触发', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const elsewhere = getByTestId('elsewhere')

    tap(elsewhere)
    tap(elsewhere)

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('卸载后移除监听', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId, unmount } = render(<Fixture onDoubleTap={onDoubleTap} />)
    const stage = getByTestId('stage')
    unmount()

    tap(stage)
    tap(stage)

    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it('回调热更新后使用最新引用（不重挂监听）', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { getByTestId, rerender } = render(<Fixture onDoubleTap={first} />)
    rerender(<Fixture onDoubleTap={second} />)
    const stage = getByTestId('stage')

    tap(stage)
    tap(stage)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('自定义阈值生效', () => {
    const clock = { now: 0 }
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(
      <Fixture onDoubleTap={onDoubleTap} options={{ delayMs: 100, now: () => clock.now }} />,
    )
    const stage = getByTestId('stage')

    tap(stage)
    clock.now = 150
    tap(stage)
    expect(onDoubleTap).not.toHaveBeenCalled()

    clock.now = 250
    tap(stage)
    clock.now = 300
    tap(stage)
    expect(onDoubleTap).toHaveBeenCalledTimes(1)
  })
})
