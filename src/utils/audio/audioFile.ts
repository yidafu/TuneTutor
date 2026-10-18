/**
 * 音频导入校验（docs/audio.md §5.1）：MIME 白名单 ∪ 扩展名白名单。
 * 浏览器对 .m4a 等常报空 MIME 或 application/octet-stream，故扩展名兜底；
 * 白名单只是第一道闸，wavesurfer 解码（error 事件）才是最终关卡（双重校验）。
 */

export const AUDIO_FILE_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'] as const

const AUDIO_MIME_TYPES: ReadonlySet<string> = new Set([
  // mp3
  'audio/mpeg',
  'audio/mp3',
  // wav
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave',
  // ogg
  'audio/ogg',
  'application/ogg',
  // m4a
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
])

export type AudioImportErrorCode = 'unsupported-audio'

export function isSupportedAudioFile(file: { name: string; type?: string }): boolean {
  const mime = (file.type ?? '').toLowerCase()
  if (mime !== '' && AUDIO_MIME_TYPES.has(mime)) return true
  const lowerName = file.name.toLowerCase()
  return AUDIO_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}
