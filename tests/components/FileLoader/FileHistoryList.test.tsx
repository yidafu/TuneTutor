import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FileHistoryList, { type FileHistoryItem } from '@/components/FileLoader/FileHistoryList'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../../helpers/ui'

// 图标是叶子组件、有自己的专属测试；这里只断言调用方传入的名字
vi.mock('@/components/icons/ThemeIcon', () => ({
  ThemeIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}))

const ITEMS: FileHistoryItem[] = [
  { id: 'a', title: 'Twinkle.musicxml', fileSize: 120 * 1024, uploadedAt: Date.now() - 5 * 60_000 },
  { id: 'b', title: 'Sonata.musicxml', fileSize: 2.5 * 1024 * 1024, uploadedAt: Date.now() },
  { id: 'c', title: 'Tiny.musicxml', fileSize: 10, uploadedAt: Date.now() - 3 * 86_400_000 },
]

describe('FileHistoryList', () => {
  it('逐条渲染标题、大小与时距', () => {
    renderWithProviders(<FileHistoryList items={ITEMS} onDelete={() => {}} />)

    expect(screen.getByText('Twinkle.musicxml')).toBeInTheDocument()
    expect(screen.getByText('Sonata.musicxml')).toBeInTheDocument()
    // 大小与时距拼在同行；时间距依赖 Intl 文案，当前时刻那条只断言大小前缀
    expect(screen.getByText('120 KB · 5 minutes ago')).toBeInTheDocument()
    expect(screen.getByText(/2\.5 MB · /)).toBeInTheDocument()
    // 不足 1 KB 向上取整为 1 KB
    expect(screen.getByText('1 KB · 3 days ago')).toBeInTheDocument()
  })

  it('删除按钮带可访问名称并回调对应 id', () => {
    const onDelete = vi.fn()
    renderWithProviders(<FileHistoryList items={ITEMS} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: `${enUS.delete} Sonata.musicxml` }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('b')
  })

  it('点击条目标题回调 onSelect(id)；未传 onSelect 时标题不触发', () => {
    const onSelect = vi.fn()
    const { rerender } = renderWithProviders(
      <FileHistoryList items={ITEMS} onDelete={() => {}} onSelect={onSelect} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sonata.musicxml' }))
    expect(onSelect).toHaveBeenCalledWith('b')

    rerender(<FileHistoryList items={ITEMS} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sonata.musicxml' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('icon prop 换条目图标（音频库传 phones），缺省仍为乐谱 note', () => {
    const { rerender } = renderWithProviders(<FileHistoryList items={ITEMS} onDelete={() => {}} />)

    expect(screen.getAllByTestId('icon-note')).toHaveLength(ITEMS.length)

    rerender(<FileHistoryList items={ITEMS} onDelete={() => {}} icon="phones" />)
    expect(screen.getAllByTestId('icon-phones')).toHaveLength(ITEMS.length)
  })

  it('activeId 命中条目标记 data-active；缺省无标记', () => {
    const { rerender } = renderWithProviders(
      <FileHistoryList items={ITEMS} onDelete={() => {}} activeId="c" />,
    )

    expect(screen.getByText('Tiny.musicxml').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByText('Sonata.musicxml').closest('[data-active]')).toBeNull()

    rerender(<FileHistoryList items={ITEMS} onDelete={() => {}} />)
    expect(screen.getByText('Tiny.musicxml').closest('[data-active]')).toBeNull()
  })
})
