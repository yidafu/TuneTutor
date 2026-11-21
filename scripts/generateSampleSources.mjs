#!/usr/bin/env node
/**
 * 构建期生成 src/audio/sampleSources.generated.ts（决策 A20，docs/audio.md §4）。
 *
 * 扫描 node_modules/tonejs-instrument-*-mp3/（包退化为纯 mp3 资源源，JS 不再被导入），
 * 产出每乐器的：npm 精确版本（钉住 jsdelivr CDN URL，版本化 immutable 缓存）、
 * CDN 文件名映射（音符键 → 'As1.mp3'）、同源打包资产 URL（深导入，CDN 失效兜底）。
 *
 * 升级任一采样包后必须重跑 `node scripts/generateSampleSources.mjs` 并提交再生文件；
 * tests/audio/sampleSources.test.ts 会按 node_modules 现状校验新鲜度。
 *
 * 严格排除不符合采样命名约定的文件（cello 的 "F2 v2.mp3"/"G2 v2.mp3"）——
 * 与旧 pnpm patch 删除的两条目语义一致（patch 已随 A20 移除）。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)

/** InstrumentType → npm 包名（src/types/audio.ts） */
const PACKAGES = {
  piano: 'tonejs-instrument-piano-mp3',
  saxophone: 'tonejs-instrument-saxophone-mp3',
  clarinet: 'tonejs-instrument-clarinet-mp3',
  flute: 'tonejs-instrument-flute-mp3',
  trumpet: 'tonejs-instrument-trumpet-mp3',
  frenchHorn: 'tonejs-instrument-french-horn-mp3',
  trombone: 'tonejs-instrument-trombone-mp3',
  violin: 'tonejs-instrument-violin-mp3',
  cello: 'tonejs-instrument-cello-mp3',
  guitar: 'tonejs-instrument-guitar-acoustic-mp3',
  guitarNylon: 'tonejs-instrument-guitar-nylon-mp3',
  bass: 'tonejs-instrument-bass-electric-mp3',
}

// 采样文件命名约定（12 包一致）：字母 [s] 八度，如 A1 / As1 / C3
const SAMPLE_FILE = /^([A-G])(s?)([0-8])\.mp3$/

/** fileBase（As1）→ 音符键（A#1）：Tone.Sampler urls 的键即触发音名 */
function noteKey(fileBase) {
  const m = SAMPLE_FILE.exec(`${fileBase}.mp3`)
  if (m === null) throw new Error(`unexpected sample file name: ${fileBase}`)
  return `${m[1]}${m[2] === 's' ? '#' : ''}${m[3]}`
}

// 自然音序（A1, A#1, B1, C2 …）便于审阅
function compareBases(a, b) {
  const ma = SAMPLE_FILE.exec(`${a}.mp3`)
  const mb = SAMPLE_FILE.exec(`${b}.mp3`)
  if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1
  if (ma[2] !== mb[2]) return ma[2] === '' ? -1 : 1
  return Number(ma[3]) - Number(mb[3])
}

function scanInstrument(type, pkg) {
  const dir = join(ROOT, 'node_modules', pkg)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const bases = readdirSync(dir)
    .filter((name) => SAMPLE_FILE.test(name))
    .map((name) => name.replace(/\.mp3$/, ''))
    .sort(compareBases)
  if (bases.length === 0) throw new Error(`no sample mp3 found in ${pkg}`)
  const version = manifest.version
  if (typeof version !== 'string' || version === '') throw new Error(`missing version in ${pkg}/package.json`)
  return { type, pkg, version, bases }
}

function emit(sources) {
  const lines = []
  lines.push(`/**
 * 构建期生成（scripts/generateSampleSources.mjs）——勿手改。
 * 升级任一 tonejs-instrument-*-mp3 包后必须重跑该脚本并提交此文件
 * （tests/audio/sampleSources.test.ts 按 node_modules 现状校验新鲜度）。
 *
 * docs/audio.md §4 / 决策 A20：12 个采样包退化为纯 mp3 资源源，包 JS 不再被导入
 * （原包构造函数吞掉 onerror 的缺陷不再经过）；CDN 走 jsdelivr 版本化 URL
 * （CORS + immutable 一年缓存），bundled 为同源打包资产 URL（CDN 失效兜底）。
 */
import type { InstrumentType } from '../types/audio'`)
  lines.push('')
  for (const s of sources) {
    for (const base of s.bases) lines.push(`import ${s.type}${base} from '${s.pkg}/${base}.mp3'`)
  }
  lines.push('')
  lines.push('/** jsdelivr npm CDN 根（CORS 全开 + 版本化 immutable 缓存，A20 实测） */')
  lines.push(`export const CDN_BASE = 'https://cdn.jsdelivr.net/npm'`)
  lines.push('')
  lines.push('/** 单乐器采样源：CDN 尝试 + 同源打包兜底，音符键均为触发音名（As1 → A#1） */')
  lines.push('export interface InstrumentSampleSource {')
  lines.push('  /** npm 包精确版本；升级采样包必须重跑生成器（新鲜度测试把关） */')
  lines.push('  readonly version: string')
  lines.push('  /** CDN 尝试的 baseUrl（含包名@版本） */')
  lines.push('  readonly cdnBase: string')
  lines.push('  /** CDN 尝试：音符键 → 文件名（相对 cdnBase） */')
  lines.push('  readonly cdnUrls: Readonly<Record<string, string>>')
  lines.push('  /** 同源兜底：音符键 → 打包资产 URL（构建产物哈希路径） */')
  lines.push('  readonly bundledUrls: Readonly<Record<string, string>>')
  lines.push('}')
  lines.push('')
  lines.push('export const SAMPLE_SOURCES: Record<InstrumentType, InstrumentSampleSource> = {')
  for (const s of sources) {
    const cdnEntries = s.bases.map((b) => `    '${noteKey(b)}': '${b}.mp3',`)
    const bundledEntries = s.bases.map((b) => `    '${noteKey(b)}': ${s.type}${b},`)
    lines.push(`  ${s.type}: {`)
    lines.push(`    version: '${s.version}',`)
    // 尾斜杠必须带:Tone.ToneAudioBuffers.add 是裸拼接(baseUrl + url,无斜杠补偿),
    // 没有它会请求成 …@1.1.2Cs3.mp3(实测 404)
    lines.push(`    cdnBase: \`\${CDN_BASE}/${s.pkg}@${s.version}/\`,`)
    lines.push('    cdnUrls: {')
    lines.push(...cdnEntries)
    lines.push('    },')
    lines.push('    bundledUrls: {')
    lines.push(...bundledEntries)
    lines.push('    },')
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

const sources = Object.entries(PACKAGES).map(([type, pkg]) => scanInstrument(type, pkg))
const out = resolve(ROOT, 'src/audio/sampleSources.generated.ts')
writeFileSync(out, emit(sources))
const total = sources.reduce((n, s) => n + s.bases.length, 0)
console.log(`sampleSources.generated.ts written: ${sources.length} instruments, ${total} samples`)
