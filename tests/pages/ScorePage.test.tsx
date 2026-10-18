import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ScorePage from '@/pages/ScorePage'
import { enUS } from '@/locales/en-US'
import { createDemoScore } from '@/utils/createDemoScore'
import { getStoredFile, listStoredFiles, saveStoredFile } from '@/utils/storage/indexedDB'
import { renderWithProviders } from '../helpers/ui'
import { FAKE_CONTAINER_RECT, FakeOsmdRender, TWO_ROW_SPEC } from '../helpers/osmdFake'

// jsdom 无 SVG 布局能力，OSMD 以替身注入（渲染与指针管线契约在 OsmdNotation.test 覆盖）
vi.mock('@/utils/notation/OsmdRender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/notation/OsmdRender')>()
  const { FakeOsmdRender } = await import('../helpers/osmdFake')
  return { ...actual, OsmdRender: FakeOsmdRender }
})

const SCORE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Import Score</work-title></work>
  <identification><creator type="composer">F. Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><key><fifths>2</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`

function renderScorePage() {
  FakeOsmdRender.spec = TWO_ROW_SPEC
  const onTempoChange = vi.fn()
  renderWithProviders(<ScorePage tempo={90} onTempoChange={onTempoChange} />)
  return onTempoChange
}

async function waitForScoreNotes(): Promise<HTMLElement[]> {
  const stage = await waitFor(() => {
    const element = document.querySelector('[data-osmd-stage]')
    expect(element).not.toBeNull()
    return element as HTMLElement
  })
  await waitFor(() => expect(stage.querySelector('[data-drag-layer]')).not.toBeNull())
  return Array.from(stage.querySelectorAll('.vf-notehead')) as HTMLElement[]
}

async function openModalAndPick(file: File) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
  const dialog = screen.getByRole('dialog')
  const input = dialog.ownerDocument.querySelector('input[type="file"]')!
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ScorePage', () => {
  afterEach(() => {
    FakeOsmdRender.spec = null
    FakeOsmdRender.last = null
  })

  it('初始回落内置示范曲：ScoreInfo 来自解析结果、渲染区接管（非占位）', () => {
    renderScorePage()

    // twinkle 示范曲实测形状：movement-title 兜底、fifths 0 → C major、<sound tempo="120"/>
    expect(screen.getByText('Twinkle Twinkle Little Star')).toBeInTheDocument()
    expect(screen.getByText(/4\/4/)).toBeInTheDocument()
    expect(screen.getByText(/♩ = 120/)).toBeInTheDocument()
    expect(screen.queryByText(enUS.notationPlaceholder)).not.toBeInTheDocument()
  })

  it('加载按钮打开弹窗，Esc 关闭', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('合法乐谱导入：解析 → 入库 → ScoreInfo 更新 → 弹窗关闭', async () => {
    renderScorePage()

    await openModalAndPick(new File([SCORE_XML], 'new-score.musicxml', { type: 'text/xml' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Import Score')).toBeInTheDocument()
    expect(screen.getByText(/3\/4/)).toBeInTheDocument()
    expect(screen.getByText(/D major/)).toBeInTheDocument()

    const records = await listStoredFiles()
    expect(records).toHaveLength(1)
    expect(records[0]!.title).toBe('Import Score')
    const stored = await getStoredFile(records[0]!.id)
    expect(stored?.rawContent).toBe(SCORE_XML)
    expect(stored?.parsedScore.composer).toBe('F. Composer')
  })

  it('非法文件（纯文本冒充 .musicxml）：报 errorNotMusicXML、不入库、弹窗保留', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderScorePage()

    await openModalAndPick(new File(['hello, world'], 'fake.musicxml', { type: 'text/plain' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(enUS.errorNotMusicXML)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await listStoredFiles()).toHaveLength(0)
    consoleError.mockRestore()
  })

  it('非法文件（损坏 .mxl）：报 errorCorruptArchive', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderScorePage()

    await openModalAndPick(new File(['definitely not a zip'], 'broken.mxl', { type: 'application/octet-stream' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(enUS.errorCorruptArchive)
    expect(await listStoredFiles()).toHaveLength(0)
    consoleError.mockRestore()
  })

  it('弹窗历史：展示 IndexedDB 记录，点标题载入、删除移除', async () => {
    const saved = await saveStoredFile({
      fileName: 'old.musicxml',
      title: 'Old Score',
      fileSize: 100,
      rawContent: SCORE_XML,
      parsedScore: createDemoScore().parsedScore,
    })
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Old Score')).toBeInTheDocument()

    // 点击历史条目 → 载入并关闭
    fireEvent.click(within(dialog).getByRole('button', { name: 'Old Score' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 再开弹窗删除
    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: `${enUS.delete} Old Score` }),
    )
    await waitFor(() => expect(screen.queryByText('Old Score')).not.toBeInTheDocument())
    expect(await getStoredFile(saved.id)).toBeUndefined()
  })

  it('启动恢复：IndexedDB 最新一份替代示范曲', async () => {
    const demo = createDemoScore()
    await saveStoredFile({
      fileName: 'restored.musicxml',
      title: 'Restored Score',
      fileSize: 200,
      rawContent: SCORE_XML,
      parsedScore: { ...demo.parsedScore, title: 'Restored Score' },
    })
    renderScorePage()

    await waitFor(() => expect(screen.getByText('Restored Score')).toBeInTheDocument())
  })

  it('播放快捷键：Space 切换播放，Esc 停止', () => {
    renderScorePage()

    fireEvent.keyDown(window, { code: 'Space' })
    expect(screen.getByText(enUS.statusPlaying)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText(enUS.statusStopped)).toBeInTheDocument()
  })

  it('弹窗打开时 Space 不再触发播放（快捷键让位）', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.loadScore) }))
    fireEvent.keyDown(window, { code: 'Space' })

    expect(screen.queryByText(enUS.statusPlaying)).not.toBeInTheDocument()
  })

  it('速度滑杆回调透传给 onTempoChange（App 共享）', () => {
    const onTempoChange = renderScorePage()

    fireEvent.change(screen.getByRole('slider', { name: enUS.tempoLabel }), { target: { value: '110' } })

    expect(onTempoChange).toHaveBeenCalledWith(110)
  })

  it('空拍选择透传到状态栏', () => {
    renderScorePage()

    fireEvent.click(
      within(screen.getByRole('group', { name: enUS.skipLabel })).getByRole('button', { name: '2' }),
    )

    expect(screen.getByText(enUS.skipBeatsShort(2))).toBeInTheDocument()
  })

  it('乐器选择持久化到 localStorage', () => {
    renderScorePage()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.instrumentPiano) }))
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: new RegExp(enUS.instrumentGuitar),
      }),
    )

    expect(window.localStorage.getItem('note-slice-preferred-instrument')).toBe(
      JSON.stringify('guitar'),
    )
    expect(
      screen.getByRole('button', { name: new RegExp(enUS.instrumentGuitar) }),
    ).toBeInTheDocument()
  })

  it('单击音符：SelectionInfo/StatusBar 显示小节选择，清除按钮复位', async () => {
    renderScorePage()
    const notes = await waitForScoreNotes()

    fireEvent.pointerDown(notes[0]!, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 60 + FAKE_CONTAINER_RECT.x,
      clientY: 40 + FAKE_CONTAINER_RECT.y,
    })
    fireEvent.pointerUp(notes[0]!, {
      pointerId: 1,
      clientX: 60 + FAKE_CONTAINER_RECT.x,
      clientY: 40 + FAKE_CONTAINER_RECT.y,
    })

    const chipText = `${enUS.selectionMeasure} · ${enUS.selectionMeasures(1, 1)} · ${enUS.selectionNoteCount(4)}`
    // SelectionInfo chip 与 StatusBar 同步同一份摘要文案
    await waitFor(() => expect(screen.getAllByText(chipText).length).toBeGreaterThanOrEqual(2))

    fireEvent.click(screen.getByRole('button', { name: enUS.selectionClear }))
    // 清除按钮消失 = 选择复位（selectionNone 同时出现在 SelectionInfo 与 StatusBar）
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: enUS.selectionClear })).not.toBeInTheDocument(),
    )
  })

  it('双击两点：乐句 chip（SelectionInfo + 覆盖层 pill）', async () => {
    renderScorePage()
    const notes = await waitForScoreNotes()

    fireEvent.doubleClick(notes[1]!)
    fireEvent.doubleClick(notes[6]!)

    const chipText = `${enUS.selectionPhrase} · ${enUS.selectionMeasures(1, 3)} · ${enUS.selectionNoteCount(6)}`
    // SelectionInfo chip 与 StatusBar 同步同一份摘要文案
    await waitFor(() => expect(screen.getAllByText(chipText).length).toBeGreaterThanOrEqual(2))
    // 覆盖层标签 pill：乐句 · 小节范围
    await waitFor(() =>
      expect(
        screen.getAllByText(`${enUS.selectionPhrase} · ${enUS.selectionMeasures(1, 3)}`).length,
      ).toBeGreaterThanOrEqual(1),
    )
  })

  it('Esc = 停止并清除选择（tech.md §6.3）；播放中的 Space 不受影响', async () => {
    renderScorePage()
    const notes = await waitForScoreNotes()

    fireEvent.pointerDown(notes[0]!, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 60 + FAKE_CONTAINER_RECT.x,
      clientY: 40 + FAKE_CONTAINER_RECT.y,
    })
    fireEvent.pointerUp(notes[0]!, {
      pointerId: 1,
      clientX: 60 + FAKE_CONTAINER_RECT.x,
      clientY: 40 + FAKE_CONTAINER_RECT.y,
    })
    expect(await screen.findByText(enUS.selectionClear)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: enUS.selectionClear })).not.toBeInTheDocument(),
    )
  })
})
