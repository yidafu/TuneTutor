import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SelectionInfo from '@/components/SelectionInfo'
import { enUS } from '@/locales/en-US'
import type { SelectionSummary } from '@/utils/notation/selection'
import { renderWithProviders } from '../helpers/ui'

const PHRASE: SelectionSummary = {
  kind: 'phrase',
  startMeasureIndex: 4,
  endMeasureIndex: 7,
  noteCount: 14,
}

describe('SelectionInfo', () => {
  it('未选择空态：显示空态 chip 与操作提示', () => {
    renderWithProviders(<SelectionInfo selection={null} invalid={false} onClear={vi.fn()} />)

    expect(screen.getByText(enUS.selectionNone)).toBeInTheDocument()
    expect(screen.getByText(enUS.selectionHint)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('已选择：朱砂 chip（乐句 · 小节范围 · 音符数）+ 清除按钮', () => {
    const onClear = vi.fn()
    renderWithProviders(<SelectionInfo selection={PHRASE} invalid={false} onClear={onClear} />)

    expect(
      screen.getByText(`${enUS.selectionPhrase} · ${enUS.selectionMeasures(5, 8)} · ${enUS.selectionNoteCount(14)}`),
    ).toBeInTheDocument()
    // 操作提示常驻（ui-design v3 selinfo 行）

    fireEvent.click(screen.getByRole('button', { name: enUS.selectionClear }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('框选/小节种类按 kind 显示', () => {
    const { rerender } = renderWithProviders(
      <SelectionInfo
        selection={{ ...PHRASE, kind: 'box', startMeasureIndex: 0, endMeasureIndex: 0 }}
        invalid={false}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByText(`${enUS.selectionBox} · ${enUS.selectionMeasures(1, 1)} · ${enUS.selectionNoteCount(14)}`)).toBeInTheDocument()

    rerender(
      <SelectionInfo
        selection={{ ...PHRASE, kind: 'measure', startMeasureIndex: 2, endMeasureIndex: 2, noteCount: 4 }}
        invalid={false}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByText(`${enUS.selectionMeasure} · ${enUS.selectionMeasures(3, 3)} · ${enUS.selectionNoteCount(4)}`)).toBeInTheDocument()
  })

  it('无效选择：提示替换操作提示（i18n）', () => {
    renderWithProviders(<SelectionInfo selection={null} invalid onClear={vi.fn()} />)

    expect(screen.getByText(enUS.selectionInvalid)).toBeInTheDocument()
    expect(screen.queryByText(enUS.selectionHint)).not.toBeInTheDocument()
  })
})
