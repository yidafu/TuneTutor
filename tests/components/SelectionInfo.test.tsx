import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SelectionInfo from '@/components/SelectionInfo'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

describe('SelectionInfo', () => {
  it('未选择空态：显示空态 chip 与操作提示', () => {
    renderWithProviders(<SelectionInfo />)

    expect(screen.getByText(enUS.selectionNone)).toBeInTheDocument()
    expect(screen.getByText(enUS.selectionHint)).toBeInTheDocument()
  })
})
