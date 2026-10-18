/**
 * 拍 ↔ 秒唯一换算入口（docs/audio.md §2.1）。
 * RealValue 是全音符分数（四分音符 = 0.25）；任何组件禁止自写乘法换算，防多处公式漂移。
 */

/** realValueToSeconds(rv, bpm) = rv × 4 × (60 / bpm)；spike V7 端到端锚点：附点四分 0.375 @ 90 BPM = 1.000s */
export function realValueToSeconds(realValue: number, bpm: number): number {
  return realValue * 4 * (60 / bpm)
}

/** beatsToSeconds(beats, bpm, beatValue) = beats × (60/bpm) × (4/beatValue)；空拍等（beatValue=4 即四分拍） */
export function beatsToSeconds(beats: number, bpm: number, beatValue = 4): number {
  return beats * (60 / bpm) * (4 / beatValue)
}
