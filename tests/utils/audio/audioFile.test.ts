import { describe, expect, it } from 'vitest'

import { AUDIO_FILE_EXTENSIONS, isSupportedAudioFile } from '@/utils/audio/audioFile'

/** 白名单 ∪ 扩展名（docs/audio.md §5.1 第一道闸；解码为第二道） */
describe('isSupportedAudioFile', () => {
  it.each([
    ['song.mp3', 'audio/mpeg'],
    ['song.mp3', ''],
    ['song.mp3', 'application/octet-stream'],
    ['song.wav', 'audio/wav'],
    ['song.wav', 'audio/x-wav'],
    ['song.ogg', 'audio/ogg'],
    ['song.ogg', 'application/ogg'],
    ['song.m4a', 'audio/mp4'],
    ['song.m4a', 'audio/x-m4a'],
    ['song.m4a', ''], // 浏览器对 m4a 常报空 MIME，扩展名兜底
    ['SONG.MP3', ''],
    ['主题曲.mp3', ''],
  ] as const)('合法：%s (%s)', (name, type) => {
    expect(isSupportedAudioFile({ name, type })).toBe(true)
  })

  it('扩展名白名单即四类', () => {
    expect([...AUDIO_FILE_EXTENSIONS]).toEqual(['.mp3', '.wav', '.ogg', '.m4a'])
  })

  it.each([
    ['notes.txt', 'text/plain'],
    ['page.pdf', 'application/pdf'],
    ['song.flac', 'audio/flac'],
    ['song.aiff', 'audio/aiff'],
    ['song.mp4', 'video/mp4'],
    ['song', ''],
    ['song.exe', 'application/octet-stream'],
  ] as const)('非法：%s (%s)', (name, type) => {
    expect(isSupportedAudioFile({ name, type })).toBe(false)
  })

  it('类型缺失视为未提供（undefined）', () => {
    expect(isSupportedAudioFile({ name: 'song.wav' })).toBe(true)
    expect(isSupportedAudioFile({ name: 'song.rar' })).toBe(false)
  })
})
