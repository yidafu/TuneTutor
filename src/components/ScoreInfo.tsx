import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  root: {
    marginBottom: '6px',
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  meta: {
    marginTop: '3px',
    fontFamily: 'var(--font-serif)',
    fontSize: '12.5px',
    fontStyle: 'italic',
    color: 'var(--color-ink-2)',
  },
})

interface ScoreInfoProps {
  title: string
  composer?: string
  keySignature?: string
  timeSignature: string
  /** 乐谱原速（BPM），非共享播放速度 */
  tempo: number
}

/** 纸面乐谱卡标题区：曲名（衬线）+ 作曲 / 调号 / 拍号 / 原速 */
export default function ScoreInfo({ title, composer, keySignature, timeSignature, tempo }: ScoreInfoProps) {
  const meta = [composer, keySignature, timeSignature, `♩ = ${tempo}`].filter(Boolean).join(' · ')

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.title)}>{title}</div>
      <div {...stylex.props(styles.meta)}>{meta}</div>
    </div>
  )
}
