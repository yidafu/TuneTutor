import { parse } from 'musicxml-io'

import type { ParsedScore } from '../types/notation'
import { scoreToParsedScore } from './notation/musicXMLParser'
import demoScoreXml from './../../public/twinkle-twinkle-little-star.musicxml?raw'

/**
 * 内置示范曲（docs/tech.md §7.3 启动恢复回落）：public/twinkle-twinkle-little-star.musicxml
 * 以 ?raw 构建期内联，无网络请求；解析一次后缓存。
 */

export interface DemoScore {
  rawContent: string
  parsedScore: ParsedScore
}

let cached: DemoScore | null = null

export function createDemoScore(): DemoScore {
  if (cached === null) {
    cached = { rawContent: demoScoreXml, parsedScore: scoreToParsedScore(parse(demoScoreXml)) }
  }
  return cached
}
