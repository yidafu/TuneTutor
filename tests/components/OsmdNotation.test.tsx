import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import OsmdNotation from '@/components/OsmdNotation'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

const { loadMock } = vi.hoisted(() => ({
  loadMock: vi.fn<(rawContent: string) => Promise<void>>(),
}))

vi.mock('@/utils/notation/OsmdRender', () => ({
  OsmdRender: class {
    load = loadMock
  },
}))

describe('OsmdNotation', () => {
  afterEach(() => {
    loadMock.mockReset()
  })

  it('未加载乐谱时渲染占位文案与页脚', () => {
    renderWithProviders(<OsmdNotation />)

    expect(screen.getByText(enUS.notationPlaceholder)).toBeInTheDocument()
    expect(screen.getByText(enUS.notationFootInfo)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('有 rawContent 时以原文加载（OSMD 与解析器同吃一份文本，决策 M2）；占位隐藏', async () => {
    loadMock.mockResolvedValue(undefined)
    const { unmount } = renderWithProviders(<OsmdNotation rawContent="<score-partwise/>" />)

    expect(screen.queryByText(enUS.notationPlaceholder)).not.toBeInTheDocument()
    await vi.waitFor(() => expect(loadMock).toHaveBeenCalledWith('<score-partwise/>'))
    unmount()
  })

  it('rawContent 变更重新加载新内容', async () => {
    loadMock.mockResolvedValue(undefined)
    const { rerender } = renderWithProviders(<OsmdNotation rawContent="<score-a/>" />)
    await vi.waitFor(() => expect(loadMock).toHaveBeenCalledWith('<score-a/>'))

    rerender(<OsmdNotation rawContent="<score-b/>" />)
    await vi.waitFor(() => expect(loadMock).toHaveBeenLastCalledWith('<score-b/>'))
    expect(loadMock).toHaveBeenCalledTimes(2)
  })

  it('渲染失败仅进 console，不抛出', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    loadMock.mockRejectedValue(new Error('boom'))
    renderWithProviders(<OsmdNotation rawContent="<broken/>" />)

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
    consoleError.mockRestore()
  })
})
