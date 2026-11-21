import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { clampPopoverX, usePopoverClamp } from '@/hooks/usePopoverClamp'

describe('clampPopoverX（phone-compat P3）', () => {
  it('弹层完整落在视口内：不偏移', () => {
    // 触发钮右沿 300，弹层 176 宽 → 左沿 124，视口 390 两侧 8px 边距内
    expect(clampPopoverX({ left: 200, right: 300 }, 176, 390)).toBe(0)
  })

  it('触发钮贴左缘、弹层左溢：右移到左边距', () => {
    // 右沿 120 - 272 = 左沿 -152 → 右移 160 落在 x=8
    expect(clampPopoverX({ left: 16, right: 120 }, 272, 390)).toBe(160)
  })

  it('弹层右溢（锚在右缘外的极端几何）：左移到右边距', () => {
    // 右沿 400 > 390-8 → 左移 18
    expect(clampPopoverX({ left: 300, right: 400 }, 176, 390)).toBe(-18)
  })

  it('视口窄于弹层+边距：贴左边距（宽度由 maxWidth 兜底）', () => {
    // 272 + 16 > 280 → 左沿钉在 8
    expect(clampPopoverX({ left: 100, right: 200 }, 272, 280)).toBe(8 - (200 - 272))
  })

  it('自定义边距生效', () => {
    expect(clampPopoverX({ left: 0, right: 100 }, 176, 390, 16)).toBe(16 - (100 - 176))
  })
})

function Fixture({
  open,
  popWidth,
  viewportWidth,
  rect,
}: {
  open: boolean
  popWidth: number
  viewportWidth: () => number
  rect: { left: number; right: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const offset = usePopoverClamp(ref, open, popWidth, viewportWidth)
  return (
    <div
      ref={(node) => {
        ref.current = node
        if (node !== null) {
          vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
            ...rect,
            x: rect.left,
            y: 0,
            top: 0,
            bottom: 40,
            width: rect.right - rect.left,
            height: 40,
            toJSON: () => ({}),
          } as DOMRect)
        }
      }}
      data-testid="anchor"
      data-offset={offset}
    />
  )
}

describe('usePopoverClamp', () => {
  // 稳定引用：hook 依赖它，内联箭头每次渲染换新会让 effect 抖动
  const narrow = (): number => 390

  it('开启时按锚盒几何算出偏移，关闭归零', () => {
    const rect = { left: 16, right: 120 }
    const { getByTestId, rerender } = render(
      <Fixture open={false} popWidth={272} viewportWidth={narrow} rect={rect} />,
    )
    expect(getByTestId('anchor').dataset.offset).toBe('0')

    rerender(<Fixture open popWidth={272} viewportWidth={narrow} rect={rect} />)
    expect(getByTestId('anchor').dataset.offset).toBe('160')

    rerender(<Fixture open={false} popWidth={272} viewportWidth={narrow} rect={rect} />)
    expect(getByTestId('anchor').dataset.offset).toBe('0')
  })

  it('开启期间 resize 重新测量', () => {
    let width = 1024
    const viewport = (): number => width
    const rect = { left: 300, right: 400 }
    const { getByTestId } = render(
      <Fixture open popWidth={176} viewportWidth={viewport} rect={rect} />,
    )
    // 宽屏：投影 [224, 400] 完整落在视口内
    expect(getByTestId('anchor').dataset.offset).toBe('0')

    width = 390 // 收窄后右沿 400 > 382 → 左移 18
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(getByTestId('anchor').dataset.offset).toBe('-18')
  })

  it('卸载后移除 resize 监听', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(
      <Fixture open popWidth={176} viewportWidth={narrow} rect={{ left: 200, right: 300 }} />,
    )
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    removeSpy.mockRestore()
  })
})
