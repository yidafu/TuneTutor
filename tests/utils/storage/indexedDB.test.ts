import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import {
  deleteAudioFile,
  deleteStoredFile,
  getAudioFile,
  getLatestAudioFile,
  getLatestStoredFile,
  getStoredFile,
  listAudioFiles,
  listStoredFiles,
  saveAudioFile,
  saveStoredFile,
} from '@/utils/storage/indexedDB'
import { createDemoScore } from '@/utils/createDemoScore'

// 每测试一个全新 IDB 工厂（setup.ts 已全局 stubGlobal，此处再保险隔离）
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

const demo = createDemoScore()

function storedInput(fileName: string, title: string) {
  return {
    fileName,
    title,
    fileSize: 1234,
    rawContent: demo.rawContent,
    parsedScore: demo.parsedScore,
  }
}

describe('files store（乐谱历史）', () => {
  it('保存后可读回：rawContent + parsedScore 完整往返', async () => {
    const saved = await saveStoredFile(storedInput('a.musicxml', 'Score A'))

    expect(saved.id).toBeTruthy()
    expect(saved.uploadedAt).toBeGreaterThan(0)

    const loaded = await getStoredFile(saved.id)
    expect(loaded?.title).toBe('Score A')
    expect(loaded?.rawContent).toBe(demo.rawContent)
    expect(loaded?.parsedScore.title).toBe(demo.parsedScore.title)
  })

  it('列表按 uploadedAt 降序，且只投影元信息（无 rawContent/parsedScore）', async () => {
    const first = await saveStoredFile(storedInput('a.musicxml', 'A'))
    await sleep(3) // uploadedAt 毫秒精度：保证 B 严格更晚
    const second = await saveStoredFile(storedInput('b.musicxml', 'B'))

    const records = await listStoredFiles()
    expect(records.map((record) => record.title)).toEqual(['B', 'A'])
    expect(records[0]).not.toHaveProperty('rawContent')
    expect(records[0]).not.toHaveProperty('parsedScore')
    expect(records[0]!.fileSize).toBe(1234)
    expect(records[0]!.fileName).toBe('b.musicxml')
    expect(first.uploadedAt).toBeLessThanOrEqual(second.uploadedAt)
  })

  it('getLatestStoredFile 返回最新一条；空库返回 undefined', async () => {
    expect(await getLatestStoredFile()).toBeUndefined()

    await saveStoredFile(storedInput('a.musicxml', 'Old'))
    await sleep(3) // uploadedAt 毫秒精度：保证严格更晚
    const latest = await saveStoredFile(storedInput('b.musicxml', 'New'))
    const found = await getLatestStoredFile()
    expect(found?.id).toBe(latest.id)
  })

  it('deleteStoredFile 删除单条', async () => {
    const saved = await saveStoredFile(storedInput('a.musicxml', 'A'))
    await deleteStoredFile(saved.id)

    expect(await getStoredFile(saved.id)).toBeUndefined()
    expect(await listStoredFiles()).toHaveLength(0)
  })
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('audioFiles store（音频历史）', () => {
  it('ArrayBuffer 结构化克隆往返，字节内容一致（决策 D3）', async () => {
    const payload = new Uint8Array([0x49, 0x44, 0x33, 0x04]).buffer
    const saved = await saveAudioFile({ fileName: 'song.mp3', fileSize: payload.byteLength, data: payload })

    const loaded = await getAudioFile(saved.id)
    expect(loaded?.fileName).toBe('song.mp3')
    expect(new Uint8Array(loaded!.data)).toEqual(new Uint8Array(payload))

    const metas = await listAudioFiles()
    expect(metas).toHaveLength(1)
    expect(metas[0]).not.toHaveProperty('data')
  })

  it('getLatestAudioFile 返回最新一条；deleteAudioFile 删除', async () => {
    expect(await getLatestAudioFile()).toBeUndefined()

    await saveAudioFile({ fileName: 'old.mp3', fileSize: 1, data: new ArrayBuffer(8) })
    await sleep(3) // uploadedAt 毫秒精度：保证严格更晚
    const latest = await saveAudioFile({ fileName: 'new.mp3', fileSize: 2, data: new ArrayBuffer(8) })
    expect((await getLatestAudioFile())?.id).toBe(latest.id)

    await deleteAudioFile(latest.id)
    expect(await getAudioFile(latest.id)).toBeUndefined()
  })

  it('两 store 互不干扰（v2 升级同时建库）', async () => {
    await saveStoredFile(storedInput('a.musicxml', 'A'))
    await saveAudioFile({ fileName: 'song.mp3', fileSize: 3, data: new ArrayBuffer(16) })

    expect(await listStoredFiles()).toHaveLength(1)
    expect(await listAudioFiles()).toHaveLength(1)
  })
})
