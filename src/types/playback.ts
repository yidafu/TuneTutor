/**
 * 播放数据契约（docs/tech.md §3 权威；细则 docs/audio.md §2）。
 * 全部时间为乐谱时域 RealValue（全音符分数），与 BPM 无关（决策 A12）：
 * BPM 只在引擎时钟边界进入换算，条目构建一次、变速零重建。
 */

/** 单个播放条目：OSMD 光标步进产出（src/audio/playbackData.ts，P1 批次落地） */
export interface PlaybackEntry {
  /** 距曲首 RealValue（全音符分数） */
  startRv: number
  /** RealValue；tie 起始音取 NoteTie.Duration（延音合并） */
  durationRv: number
  measureIndex: number
  /** 全曲连续编号，与命中测试索引同源（休止符占位递增，audio.md §2.4） */
  noteIndex: number
  /** Tone Frequency 可解析的音名 */
  noteName: string
}

/** 循环区间：乐谱时域 + 空拍数；秒只在引擎入口/UI 显示时现算 */
export interface LoopRange {
  startRv: number
  endRv: number
  /** 空拍（1–8 拍），由用户设置注入 */
  skipBeats: number
}
