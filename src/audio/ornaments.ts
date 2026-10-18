/**
 * 装饰音演奏展开（docs/audio.md §2.2 规则 8/9，决策 A17）。
 * 官方播放器不消费装饰音（createVoiceEntriesForOrnament 为 OSMD 暴露但无人调用的接口），
 * 本模块将其文档化为产品行为；切片时长/顺序采用 OSMD 同款语义，波音方向按 MusicXML
 * 标准语义（mordent = 下邻音；OSMD 枚举实现方向相反，见 audio.md 决策 A17 记录）。
 * 子条目共享主音 noteIndex（选择域按组跨度解析，src/utils/notation/selection.ts），
 * noteIndex 计数不变——occupiesPlaybackSlot 硬约束（audio.md §2.4）不动。
 * 本文件保持纯函数、零 OSMD 依赖，OSMD 数据提取在 playbackData.ts。
 */
import type { PlaybackEntry } from '../types/playback'

/** 倚音单音默认时值（十六分；上限，实际可能被可用空间挤压，§2.2 规则 8） */
export const GRACE_DEFAULT_RV = 0.0625

export type OrnamentKind =
  | 'trill'
  | 'turn'
  | 'inverted-turn'
  | 'delayed-turn'
  | 'delayed-inverted-turn'
  | 'mordent'
  | 'inverted-mordent'

/** OSMD OrnamentEnum（数值）→ 播放域种类；未知值返回 null（原样播放） */
export function ornamentKindFromEnum(value: number): OrnamentKind | null {
  switch (value) {
    case 0:
      return 'trill'
    case 1:
      return 'turn'
    case 2:
      return 'inverted-turn'
    case 3:
      return 'delayed-turn'
    case 4:
      return 'delayed-inverted-turn'
    case 5:
      return 'mordent'
    case 6:
      return 'inverted-mordent'
    default:
      return null
  }
}

function slice(
  base: PlaybackEntry,
  startRv: number,
  durationRv: number,
  noteName: string,
): PlaybackEntry {
  return { ...base, startRv, durationRv, noteName }
}

/**
 * 装饰音 → 子条目序列（OSMD VoiceEntry.createVoiceEntriesForOrnament 同款切片语义）：
 * - trill：8 等分，主音/上邻音交替；
 * - turn / inverted-turn：4 等分，上起/下起的回音图形；
 * - delayed-turn / delayed-inverted-turn：主音占前半，后半 4×(1/8) 回音图形；
 * - mordent：主音(1/4) + 下邻音(1/4) + 主音(1/2)；inverted-mordent 上邻音。
 * upper/lower = 邻音音名（调用方按调号解析）；短时值下切片可能极短，不设下限（同 OSMD）。
 */
export function realizeOrnament(
  base: PlaybackEntry,
  kind: OrnamentKind,
  upper: string,
  lower: string,
): PlaybackEntry[] {
  const { startRv, durationRv, noteName } = base
  switch (kind) {
    case 'trill': {
      const d = durationRv / 8
      const order = [noteName, upper, noteName, upper, noteName, upper, noteName, upper]
      return order.map((name, i) => slice(base, startRv + i * d, d, name))
    }
    case 'turn': {
      const d = durationRv / 4
      const order = [upper, noteName, lower, noteName]
      return order.map((name, i) => slice(base, startRv + i * d, d, name))
    }
    case 'inverted-turn': {
      const d = durationRv / 4
      const order = [lower, noteName, upper, noteName]
      return order.map((name, i) => slice(base, startRv + i * d, d, name))
    }
    case 'delayed-turn':
    case 'delayed-inverted-turn': {
      const half = durationRv / 2
      const d = durationRv / 8
      const order =
        kind === 'delayed-turn'
          ? [upper, noteName, lower, noteName]
          : [lower, noteName, upper, noteName]
      const result = [slice(base, startRv, half, noteName)]
      order.forEach((name, i) => result.push(slice(base, startRv + half + i * d, d, name)))
      return result
    }
    case 'mordent':
    case 'inverted-mordent': {
      const quarter = durationRv / 4
      const neighbor = kind === 'mordent' ? lower : upper
      return [
        slice(base, startRv, quarter, noteName),
        slice(base, startRv + quarter, quarter, neighbor),
        slice(base, startRv + quarter * 2, durationRv - quarter * 2, noteName),
      ]
    }
  }
}

export interface GracePlacement {
  /** 每个倚音条目的 startRv（依音乐顺序排列，相邻相接） */
  startsRv: number[]
  /** 单个倚音时值 */
  durationRv: number
  /** 主音条目需顺延的时值（挤占主音头部时 > 0；主音 durationRv 同额扣减） */
  mainShiftRv: number
}

/**
 * 倚音时间安放（§2.2 规则 8）：倚音块贴着主音起点向前铺；主音前的空闲（前条目末刻到
 * 主音起点）够放则整块前移（不打扰主旋律）；不够则差额挤占主音头部（主音顺延、时长
 * 扣减，长倚音式处理）。总时值钳到主音一半；无处安放（主音过短）返回 null（整组丢弃）。
 */
export function placeGraceNotes(
  count: number,
  mainStartRv: number,
  mainDurationRv: number,
  prevEndRv: number,
): GracePlacement | null {
  if (count <= 0) return null
  const total = Math.min(count * GRACE_DEFAULT_RV, mainDurationRv / 2)
  if (total <= 0) return null
  const available = Math.max(0, mainStartRv - prevEndRv)
  if (available >= total) {
    const blockStart = mainStartRv - total
    return {
      startsRv: Array.from({ length: count }, (_, i) => blockStart + (i * total) / count),
      durationRv: total / count,
      mainShiftRv: 0,
    }
  }
  const shift = total - available
  return {
    startsRv: Array.from({ length: count }, (_, i) => mainStartRv - available + (i * total) / count),
    durationRv: total / count,
    mainShiftRv: shift,
  }
}
