/**
 * 乐谱解析契约（docs/tech.md §3）。
 * `ParsedScore` 只服务元信息展示与存储缓存，禁止参与播放数据与索引
 * （播放数据唯一来源是 OSMD 光标，docs/tech.md 决策 D1）。
 * 标记域（tie/tuplet/grace/markings…）映射细则见 docs/musicxml.md §2，域内冲突以该文为准。
 */

export interface Note {
  /** "C4"；休止为 "rest"；unpitched 取 displayStep/displayOctave 拼接 */
  pitch: string
  /** 显示标签：noteType+dots 派生（"q."/"8"/"16"…）；反推不中 → "x" */
  duration: string
  /** ⭐ 权威发声时值（全音符分数）= duration ÷ 有效 divisions ÷ 4；附点与连音缩放已含 */
  realValue: number
  isRest: boolean
  /** ⚠️ musicxml-io 字段名是 dots（不是 dot） */
  dots: number
  octave: number
  accidentals?: string
  voice: number
  staff?: number
  type?: string
  isChord?: boolean
  /** 连结线（延音线）；解析层只如实标记不合并（docs/musicxml.md 决策 M6） */
  tie?: 'start' | 'stop' | 'continue'
  /** 连音比率（time-modification 原样） */
  tuplet?: { actualNotes: number; normalNotes: number }
  /** 倚音：graceSlash=true 短倚音（斜线），false 长倚音 */
  isGrace?: boolean
  graceSlash?: boolean
  /** cue 小音符：占时值，按普通音符播放 */
  isCue?: boolean
  /**
   * 其余标记扁平标签（capture-only，docs/musicxml.md 决策 M8）。
   * 文法："<kind>" 或 "<kind>:<value>"，带编号时后缀 #n（如 "slur:start#1"）。
   */
  markings?: string[]
}

export interface Measure {
  index: number
  /** entries 中 type==='note' 的出现顺序（含和弦音、倚音、全部 voice）；非播放索引来源 */
  notes: Note[]
  /** 该小节起生效；无变更则 undefined */
  timeSignature?: string
  keySignature?: string
  /** 该小节声明的 divisions；undefined = 继承上一小节（docs/musicxml.md 决策 M4） */
  divisions?: number
  /** 多小节休止小节数（measure-style/multiple-rest） */
  multipleRest?: number
}

export interface ParsedScore {
  /** metadata.workTitle，回落 movementTitle（spike §13-V2） */
  title: string
  /** metadata.creators 中 type=composer 的 value */
  composer?: string
  measures: Measure[]
  /** 全曲首个 <sound tempo>；样例谱普遍缺失，兜底 60 */
  tempo: number
  /** "4/4"；取首个 attributes.time，后续拍号变更见 Measure.timeSignature；composite 拍受 io 0.2.11 限制退化为首数字（"3+2" → "3"，docs/musicxml.md §4.9） */
  timeSignature: string
  /** 首个调号（fifths → 调名，"G major" / "E minor"；UI 层再做 i18n 转写）；后续变更见 Measure.keySignature */
  keySignature?: string
  /** 首小节有效 divisions；逐小节有效值见 Measure.divisions */
  divisions: number
}
