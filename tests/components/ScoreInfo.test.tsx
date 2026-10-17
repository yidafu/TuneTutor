import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScoreInfo from '@/components/ScoreInfo'

describe('ScoreInfo', () => {
  it('渲染曲名与完整元信息行（作曲·调号·拍号·原速）', () => {
    render(
      <ScoreInfo
        title="Twinkle"
        composer="Traditional"
        keySignature="C major"
        timeSignature="4/4"
        tempo={60}
      />,
    )

    expect(screen.getByText('Twinkle')).toBeInTheDocument()
    expect(screen.getByText('Traditional · C major · 4/4 · ♩ = 60')).toBeInTheDocument()
  })

  it('可选字段缺省时不出现在元信息行（含分隔符）', () => {
    render(<ScoreInfo title="Minimal" timeSignature="3/4" tempo={90} />)

    expect(screen.getByText('Minimal')).toBeInTheDocument()
    expect(screen.getByText('3/4 · ♩ = 90')).toBeInTheDocument()
  })
})
