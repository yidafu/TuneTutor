import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CDN_BASE, SAMPLE_SOURCES } from '@/audio/sampleSources.generated'
import type { InstrumentType } from '@/types/audio'

/**
 * sampleSources.generated.ts 新鲜度守卫（决策 A20）：
 * 升级任一 tonejs-instrument-*-mp3 包后必须重跑 scripts/generateSampleSources.mjs
 * 并提交再生文件——这里按 node_modules 现状独立重扫（读数据文件走 cwd，tests 约定），
 * 版本或采样清单漂移即失败。
 */

// 采样文件命名约定（12 包一致）：字母 [s] 八度，如 A1 / As1 / C3（与生成器同一套推导）
const SAMPLE_FILE = /^([A-G])(s?)([0-8])\.mp3$/

function noteKey(fileBase: string): string {
  const m = SAMPLE_FILE.exec(`${fileBase}.mp3`)
  expect(m, `unexpected sample file name: ${fileBase}`).not.toBeNull()
  return `${m![1]}${m![2] === 's' ? '#' : ''}${m![3]}`
}

const TYPES = Object.keys(SAMPLE_SOURCES) as InstrumentType[]

describe('sampleSources.generated 新鲜度守卫（决策 A20）', () => {
  it('十二种乐器的版本与采样清单与 node_modules 一致', () => {
    expect(TYPES).toHaveLength(12)
    for (const type of TYPES) {
      const source = SAMPLE_SOURCES[type]
      // 包名从 cdnBase 反解（不在此处复制 type→包名映射，避免双份漂移）
      expect(source.cdnBase.startsWith(`${CDN_BASE}/`), type).toBe(true)
      const segment = source.cdnBase.slice(CDN_BASE.length + 1)
      const at = segment.lastIndexOf('@')
      const pkg = segment.slice(0, at)
      const dir = resolve(process.cwd(), 'node_modules', pkg)
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        version: string
      }
      expect(source.version, `${type} 版本与 ${pkg}/package.json 不一致`).toBe(manifest.version)
      // 尾斜杠必须带:Tone.ToneAudioBuffers.add 是裸拼接(baseUrl + url,无斜杠补偿)
      expect(source.cdnBase).toBe(`${CDN_BASE}/${pkg}@${manifest.version}/`)

      const files = readdirSync(dir).filter((name) => SAMPLE_FILE.test(name))
      const expectedKeys = files.map((name) => noteKey(name.replace(/\.mp3$/, ''))).sort()
      expect(Object.keys(source.cdnUrls).sort(), `${type} cdnUrls 与包内采样文件不一致`).toEqual(expectedKeys)
      expect(Object.keys(source.bundledUrls).sort(), `${type} bundledUrls 与包内采样文件不一致`).toEqual(expectedKeys)
      for (const [note, file] of Object.entries(source.cdnUrls)) {
        expect(noteKey(file.replace(/\.mp3$/, '')), `${type} ${file} 的音符键`).toBe(note)
      }
    }
  })

  it('钢琴全量 85 采样（决策 A6：不用 minify）', () => {
    expect(Object.keys(SAMPLE_SOURCES.piano.cdnUrls)).toHaveLength(85)
    expect(SAMPLE_SOURCES.piano.cdnUrls['A#1']).toBe('As1.mp3')
    expect(SAMPLE_SOURCES.piano.cdnUrls['C8']).toBe('C8.mp3')
  })

  it('cello 不含被排除的 "F2 v2"/"G2 v2"（非法文件名不入清单，与旧 patch 语义一致）', () => {
    for (const note of Object.keys(SAMPLE_SOURCES.cello.cdnUrls)) {
      expect(note).toMatch(/^[A-G]#?[0-8]$/)
    }
  })
})
