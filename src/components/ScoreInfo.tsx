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
    <div className="mb-1.5 text-center">
      <div className="font-serif text-[22px] font-bold tracking-[1px]">{title}</div>
      <div className="mt-[3px] font-serif text-[12.5px] italic text-ink-2">{meta}</div>
    </div>
  )
}
