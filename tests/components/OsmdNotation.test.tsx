import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OsmdNotation from '@/components/OsmdNotation'
import { enUS } from '@/locales/en-US'
import { renderWithProviders } from '../helpers/ui'

describe('OsmdNotation', () => {
  it('未接入 OSMD 时渲染占位文案与页脚', () => {
    renderWithProviders(<OsmdNotation />)

    expect(screen.getByText(enUS.notationPlaceholder)).toBeInTheDocument()
    expect(screen.getByText(enUS.notationFootInfo)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
