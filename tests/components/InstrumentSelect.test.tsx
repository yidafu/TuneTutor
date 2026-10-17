import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InstrumentSelect from '@/components/InstrumentSelect'
import { enUS } from '@/locales/en-US'
import { INSTRUMENT_TYPES } from '@/types/audio'
import { renderWithProviders } from '../helpers/ui'

describe('InstrumentSelect', () => {
  it('触发按钮显示当前乐器（emoji + 标签）', () => {
    renderWithProviders(<InstrumentSelect value="saxophone" onChange={() => {}} />)

    const trigger = screen.getByRole('button', { name: new RegExp(enUS.instrumentSaxophone) })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('展开列出全部 7 种乐器并标记选中项', () => {
    renderWithProviders(<InstrumentSelect value="piano" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))

    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options).toHaveLength(INSTRUMENT_TYPES.length)
    expect(
      within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(enUS.instrumentPiano) }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(enUS.instrumentFlute) }),
    ).toHaveAttribute('aria-selected', 'false')
  })

  it('选择新乐器回调并收起菜单', () => {
    const onChange = vi.fn()
    renderWithProviders(<InstrumentSelect value="piano" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: new RegExp(enUS.instrumentViolin),
      }),
    )

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('violin')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('再次点击当前值外的按钮不会误触发 onChange', () => {
    const onChange = vi.fn()
    renderWithProviders(<InstrumentSelect value="piano" onChange={onChange} />)
    // 展开后点触发按钮本身只收起菜单
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
