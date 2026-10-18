import type { ParsedScore } from './notation'

/**
 * IndexedDB 行契约（docs/tech.md §3/§7，库名 tune-tutor-db 版本 2）。
 * rawContent（解包后主谱 XML 原文）是持久事实；parsedScore 是可由 rawContent 重建的解析缓存
 * （docs/musicxml.md 决策 M2）。
 */
export interface StoredFile {
  id: string
  fileName: string
  title: string
  composer?: string
  uploadedAt: number
  fileSize: number
  rawContent: string
  parsedScore: ParsedScore
}

/** `files` 列表投影：不含 rawContent/parsedScore 大字段 */
export interface StoredFileMeta {
  id: string
  fileName: string
  title: string
  composer?: string
  uploadedAt: number
  fileSize: number
}

/** 原曲页音频行；存 ArrayBuffer 保证 structured-clone 兼容（docs/tech.md 决策 D3） */
export interface StoredAudioFile {
  id: string
  fileName: string
  fileSize: number
  uploadedAt: number
  data: ArrayBuffer
}

/** `audioFiles` 列表投影：不含 data 大字段 */
export interface StoredAudioFileMeta {
  id: string
  fileName: string
  fileSize: number
  uploadedAt: number
}
