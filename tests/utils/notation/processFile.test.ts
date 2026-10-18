import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'

import { ImportFileError, processFile } from '@/utils/notation/processFile'

/** 最小合法 score-partwise */
const SCORE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Import Fixture</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`

function makeFile(name: string, content: string | Uint8Array, type = 'application/octet-stream'): File {
  return new File([content as BlobPart], name, { type })
}

async function unpackSource(file: File): Promise<string> {
  const processed = await processFile(file)
  return processed.rawContent
}

function errorCode(error: unknown): string {
  expect(error).toBeInstanceOf(ImportFileError)
  return (error as ImportFileError).code
}

async function expectImportError(file: File, code: ImportFileError['code']): Promise<void> {
  await expect(processFile(file)).rejects.toSatisfy((error: unknown) => errorCode(error) === code)
}

describe('processFile 合法文件', () => {
  it('明文 .musicxml：rawContent 为原文、parsedScore 出元信息', async () => {
    const processed = await processFile(makeFile('sonata.musicxml', SCORE_XML, 'application/vnd.recordare.musicxml+xml'))
    expect(processed.rawContent).toBe(SCORE_XML)
    expect(processed.parsedScore.title).toBe('Import Fixture')
    expect(processed.parsedScore.timeSignature).toBe('4/4')
    expect(processed.parsedScore.measures).toHaveLength(1)
    expect(processed.fileName).toBe('sonata.musicxml')
    expect(processed.fileSize).toBe(new TextEncoder().encode(SCORE_XML).byteLength)
  })

  it('.xml 扩展同样可导', async () => {
    const processed = await processFile(makeFile('sonata.xml', SCORE_XML, 'text/xml'))
    expect(processed.parsedScore.title).toBe('Import Fixture')
  })

  it('合法 .mxl：container.xml → 首个 rootfile → 主谱解包（决策 M1）', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`)
    zip.file('score.musicxml', SCORE_XML)
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const rawContent = await unpackSource(makeFile('sonata.mxl', bytes))
    expect(rawContent).toBe(SCORE_XML)
  })

  it('.mxl 无 container.xml 时回落：META-INF 外首个 .xml 条目（§1.2-3）', async () => {
    const zip = new JSZip()
    zip.file('META-INF/manifest.xml', '<container/>')
    zip.file('assets/cover.png', 'binary-ish')
    zip.file('score.musicxml', SCORE_XML)
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const rawContent = await unpackSource(makeFile('fallback.mxl', bytes))
    expect(rawContent).toBe(SCORE_XML)
  })

  it('扩展名非 .mxl 但带 zip 魔数 → 仍按压缩包解包（§1.1 魔数判定）', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="s.xml"/></rootfiles></container>')
    zip.file('s.xml', SCORE_XML)
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const rawContent = await unpackSource(makeFile('renamed.dat', bytes))
    expect(rawContent).toBe(SCORE_XML)
  })

  it('内容为合法 XML 但扩展名未知（.txt）→ 走文本管线照常解析（浏览器 MIME 不可信，宽容路径）', async () => {
    const processed = await processFile(makeFile('score.txt', SCORE_XML, 'text/plain'))
    expect(processed.parsedScore.title).toBe('Import Fixture')
  })
})

describe('processFile 非法文件（E1–E4，docs/musicxml.md §6）', () => {
  it('E1：损坏 zip（文本字节冒充 .mxl，仓库损坏样例同类）', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expectImportError(makeFile('broken.mxl', 'this is not a zip at all'), 'corrupt-archive')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('E1：zip 内没有任何 MusicXML 条目', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', '<container><rootfiles/></container>')
    zip.file('readme.txt', 'nothing in here')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    await expectImportError(makeFile('empty.mxl', bytes), 'corrupt-archive')
  })

  it('E2：非 XML 纯文本', async () => {
    await expectImportError(makeFile('hello.musicxml', 'hello, world'), 'not-musicxml')
  })

  it('E2：timewise 根元素（io 仅支持 score-partwise）', async () => {
    const timewise = `<?xml version="1.0" encoding="UTF-8"?>
<score-timewise version="3.1">
  <measure number="1"><part id="P1"></part></measure>
</score-timewise>`
    await expectImportError(makeFile('timewise.musicxml', timewise), 'not-musicxml')
  })

  it('E3：XML 语法错误', async () => {
    const broken = SCORE_XML.replace('</score-partwise>', '')
    await expectImportError(makeFile('broken.musicxml', broken), 'parse-failed')
  })

  it('E4：XML 声明非 UTF-8（GB2312 老谱，决策 M9 报错不静默转码）', async () => {
    const gb = SCORE_XML.replace('encoding="UTF-8"', 'encoding="GB2312"')
    await expectImportError(makeFile('gb.musicxml', gb), 'unsupported-encoding')
  })

  it('E4 同样作用于 .mxl 解包后的主谱文本', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>')
    zip.file('score.musicxml', SCORE_XML.replace('encoding="UTF-8"', 'encoding="Shift_JIS"'))
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    await expectImportError(makeFile('gb.mxl', bytes), 'unsupported-encoding')
  })
})
