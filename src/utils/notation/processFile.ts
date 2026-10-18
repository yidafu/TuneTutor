import JSZip from 'jszip'
import { parse } from 'musicxml-io'

import type { ParsedScore } from '../../types/notation'
import { scoreToParsedScore } from './musicXMLParser'

/**
 * 乐谱导入管线（docs/musicxml.md §1）：
 * File → bytes →（.mxl 解包）→ UTF-8 文本 → musicxml-io parse → ParsedScore。
 * rawContent 一律是解包后主谱 XML 原文（决策 M2），OSMD 与解析器同吃一份文本；
 * 不使用 musicxml-io 的 parseCompressed/parseAuto（决策 M1）。
 * 错误四分类 E1–E4（docs/musicxml.md §6）：任何错误不入库、不留半成品（M10）。
 */

export type ImportErrorCode =
  /** E1：.mxl 损坏 / 压缩包内无主谱 */
  | 'corrupt-archive'
  /** E2：非 MusicXML / timewise / 根元素不符 */
  | 'not-musicxml'
  /** E3：XML 语法错误等解析异常 */
  | 'parse-failed'
  /** E4：XML 声明非 UTF-8 编码（决策 M9，报错不静默转码） */
  | 'unsupported-encoding'

export class ImportFileError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, message?: string) {
    super(message)
    this.name = 'ImportFileError'
    this.code = code
  }
}

export interface ProcessedScore {
  /** 解包后主谱 XML 原文；OSMD 渲染输入与 IndexedDB 持久化事实 */
  rawContent: string
  parsedScore: ParsedScore
  fileName: string
  fileSize: number
}

/** XML 声明的 encoding 属性（M9：只承诺 UTF-8，其余报 E4） */
const ENCODING_DECLARATION = /<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i

function assertUtf8(xmlText: string): void {
  const declared = ENCODING_DECLARATION.exec(xmlText)?.[1]?.toLowerCase()
  if (declared !== undefined && declared !== 'utf-8' && declared !== 'utf8') {
    throw new ImportFileError(
      'unsupported-encoding',
      `XML declares encoding "${declared}"; only UTF-8 is supported (docs/musicxml.md M9)`,
    )
  }
}

function decodeXmlText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8').decode(bytes)
  assertUtf8(text)
  return text
}

/**
 * XML 良构性前置闸（E3）。musicxml-io 0.2.11 是恢复式解析：截断/错配标签等语法错误
 * 实测全部被吞、静默产出残缺 Score——良构性必须在 io 之前把关，否则损坏文件会
 * 「导入成功」而渲染出残谱。浏览器与 jsdom 均以 parsererror 元素报告。
 */
function assertWellFormed(xmlText: string): void {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  } catch (error) {
    throw new ImportFileError('parse-failed', `XML is not well-formed: ${String(error)}`)
  }
  if (doc.querySelector('parsererror') !== null) {
    throw new ImportFileError('parse-failed', 'XML is not well-formed (parsererror)')
  }
}

/** 类型判定：扩展名优先，.mxl 或 zip 魔数 PK\x03\x04 走解包（docs/musicxml.md §1.1） */
function isZipFile(fileName: string, bytes: Uint8Array): boolean {
  if (fileName.toLowerCase().endsWith('.mxl')) return true
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function readRootfilePath(containerXml: string): string | null {
  const doc = new DOMParser().parseFromString(containerXml, 'application/xml')
  if (doc.querySelector('parsererror') !== null) return null
  const rootfile =
    doc.querySelector('container > rootfiles > rootfile') ?? doc.querySelector('rootfiles > rootfile')
  return rootfile?.getAttribute('full-path') ?? null
}

/** .mxl 解包（决策 M1）：container.xml 首个 rootfile → 主谱；缺失/异常回落第一个 META-INF 外的 .xml 条目；均失败 E1 */
async function unpackMxl(bytes: Uint8Array): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch (error) {
    throw new ImportFileError('corrupt-archive', `JSZip failed to open archive: ${String(error)}`)
  }

  let mainPath: string | null = null
  const container = zip.file('META-INF/container.xml')
  if (container !== null) {
    try {
      mainPath = readRootfilePath(await container.async('text'))
    } catch {
      mainPath = null
    }
  }
  if (mainPath === null) {
    const fallback = Object.keys(zip.files).find(
      (name) => !name.startsWith('META-INF/') && /\.musicxml?$/i.test(name) && zip.files[name]!.dir === false,
    )
    mainPath = fallback ?? null
  }
  if (mainPath === null) {
    throw new ImportFileError('corrupt-archive', 'Could not find MusicXML file in compressed archive')
  }

  const main = zip.file(mainPath)
  if (main === null || main.dir) {
    throw new ImportFileError('corrupt-archive', `Main score entry not found in archive: ${mainPath}`)
  }
  const mainBytes = await main.async('arraybuffer')
  return decodeXmlText(new Uint8Array(mainBytes))
}

/**
 * 解析乐谱文件。错误以 ImportFileError 抛出（E1–E4），原始报错进 console 供排查
 * （docs/musicxml.md §6）；调用方负责 i18n 提示与「不入库、不留半成品」。
 */
export async function processFile(file: File): Promise<ProcessedScore> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  let rawContent: string
  try {
    rawContent = isZipFile(file.name, bytes) ? await unpackMxl(bytes) : decodeXmlText(bytes)
    // 良构闸只对 XML 文档生效；纯文本等非 XML 内容交由 io 分类为 E2
    if (rawContent.trimStart().startsWith('<')) assertWellFormed(rawContent)
  } catch (error) {
    if (error instanceof ImportFileError) {
      console.error(`[processFile] ${error.code}: ${error.message}`)
      throw error
    }
    throw new ImportFileError('corrupt-archive', String(error))
  }

  let score
  try {
    score = parse(rawContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[processFile] musicxml-io parse failed: ${message}`)
    if (message.includes('Unsupported MusicXML format')) {
      throw new ImportFileError('not-musicxml', message)
    }
    throw new ImportFileError('parse-failed', message)
  }

  return {
    rawContent,
    parsedScore: scoreToParsedScore(score),
    fileName: file.name,
    fileSize: file.size,
  }
}
