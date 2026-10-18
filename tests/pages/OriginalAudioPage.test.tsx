import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import OriginalAudioPage from '@/pages/OriginalAudioPage'
import { enUS } from '@/locales/en-US'
import { ZOOM_MAX_PX_PER_SEC } from '@/utils/audio/sliceUtils'
import { FakeRegionsPlugin, FakeWaveSurfer, FakeZoomPlugin } from '../helpers/wavesurferFake'
import { renderWithProviders } from '../helpers/ui'
import { listAudioFiles, saveAudioFile } from '@/utils/storage/indexedDB'

vi.mock('wavesurfer.js', async () => {
  const { FakeWaveSurfer } = await import('../helpers/wavesurferFake')
  return { default: { create: FakeWaveSurfer.create } }
})
vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', async () => {
  const { FakeRegionsPlugin } = await import('../helpers/wavesurferFake')
  return { default: { create: FakeRegionsPlugin.create } }
})
vi.mock('wavesurfer.js/dist/plugins/zoom.esm.js', async () => {
  const { FakeZoomPlugin } = await import('../helpers/wavesurferFake')
  return { default: { create: FakeZoomPlugin.create } }
})

function renderAudioPage() {
  return renderWithProviders(<OriginalAudioPage tempo={90} />)
}

function importAudioFile(name = 'song.mp3', type = 'audio/mpeg'): File {
  // 最小 mp3 形状即可：页面只做白名单校验 + ArrayBuffer 转存，解码交给 wavesurfer（mock）
  return new File([new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00])], name, { type })
}

async function importViaInput(file: File) {
  const input = document.querySelector('input[type="file"]')!
  fireEvent.change(input, { target: { files: [file] } })
}

function latestPage(): { ws: FakeWaveSurfer; regions: FakeRegionsPlugin } {
  const ws = FakeWaveSurfer.all.at(-1)!
  const regions = FakeRegionsPlugin.all.at(-1)!
  return { ws, regions }
}

beforeEach(() => {
  FakeWaveSurfer.reset()
  FakeRegionsPlugin.reset()
  FakeZoomPlugin.reset()
})

afterEach(() => {
  vi.useRealTimers()
})

/** jsdom 无布局：给波形容器钉一个可视宽度（适应宽度 = 宽 / 时长 的计算输入） */
function stubStageWidth(width: number): void {
  const stage = document.querySelector('[data-wave-stage]')
  if (stage !== null) {
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: width })
  }
}

/** 双击命中走 getBoundingClientRect（容器相对 px）：钉矩形 left=0，宽度即映射时长 */
function stubStageRect(width: number): void {
  const stage = document.querySelector('[data-wave-stage]')
  if (stage !== null) {
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: width,
      bottom: 150,
      width,
      height: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  }
}

/** 走「启动恢复」路径装载：导入路径会清空旧切片（新音频不继承切片） */
async function loadWithSlice() {
  localStorage.setItem('note-slice-audio-slice', JSON.stringify({ startTime: 42, endTime: 65 }))
  await saveAudioFile({ fileName: 'song.mp3', fileSize: 8, data: new ArrayBuffer(8) })
  renderAudioPage()
  await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
  const { ws, regions } = latestPage()
  ws.emitReady(204)
  await screen.findByText(/3:24/)
  return { ws, regions }
}

describe('OriginalAudioPage 空态与导入', () => {
  it('空态：导入入口 + 隐藏 input（accept 白名单扩展）', () => {
    renderAudioPage()

    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    const input = document.querySelector('input[type="file"]')!
    expect(input).toHaveAttribute('accept', '.mp3,.wav,.ogg,.m4a,audio/*')
    expect(FakeWaveSurfer.all).toHaveLength(0)
  })

  it('非法文件（.txt text/plain）：报 errorUnsupportedAudio、不建 wavesurfer、不入库', async () => {
    renderAudioPage()

    await importViaInput(new File(['plain text'], 'notes.txt', { type: 'text/plain' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(enUS.errorUnsupportedAudio)
    expect(FakeWaveSurfer.all).toHaveLength(0)
    expect(await listAudioFiles()).toHaveLength(0)
  })

  it('合法 mp3：入 IndexedDB → wavesurfer 创建 → loadBlob 收到 Blob', async () => {
    renderAudioPage()

    await importViaInput(importAudioFile())

    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws } = latestPage()
    expect(ws.loadBlobCalls).toBe(1)
    expect(ws.blob).toBeInstanceOf(Blob)
    expect((await listAudioFiles()).map((record) => record.fileName)).toEqual(['song.mp3'])
    // 元信息行显示文件名；ready 前不显示时长/采样率
    expect(screen.getByText('song.mp3')).toBeInTheDocument()
  })

  it('ready 事件：显示时长与采样率；拖选创建已启用', async () => {
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions } = latestPage()

    ws.emitReady(204)

    expect(await screen.findByText(/3:24/)).toBeInTheDocument()
    expect(screen.getByText(/44\.1 kHz/)).toBeInTheDocument()
    expect(regions.dragSelectionOptions).not.toBeNull()
  })

  it('启动恢复：IndexedDB 最新音频自动装载', async () => {
    await saveAudioFile({ fileName: 'restored.mp3', fileSize: 8, data: new ArrayBuffer(8) })
    renderAudioPage()

    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    expect(screen.getByText('restored.mp3')).toBeInTheDocument()
  })
})

describe('OriginalAudioPage 切片与循环', () => {
  it('ready 后按已存切片恢复 region（单切片），信息行显示循环区间', async () => {
    const { regions } = await loadWithSlice()

    expect(regions.getRegions()).toHaveLength(1)
    expect(regions.getRegions()[0]!.start).toBe(42)
    expect(regions.getRegions()[0]!.end).toBe(65)
    expect(screen.getByText(enUS.loopChipLabel(23))).toBeInTheDocument()
    expect(screen.getByText(enUS.loopRange('0:42', '1:05'))).toBeInTheDocument()
  })

  it('region-out 循环：暂停 → 空拍(0 拍=setTimeout(0)) → 回卷切片起点重播', async () => {
    const { ws, regions } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    await ws.play()
    expect(ws.isPlaying()).toBe(true)

    vi.useFakeTimers()
    regions.emitRegionOut(region)
    expect(ws.isPlaying()).toBe(false) // 暂停等空拍

    vi.advanceTimersByTime(10) // gap 0 拍 @90BPM = 0s → setTimeout(0)
    expect(ws.getCurrentTime()).toBe(42)
    expect(ws.isPlaying()).toBe(true)
  })

  it('空拍 2 拍 @90BPM ≈ 1333ms 后才回卷', async () => {
    const { ws, regions } = await loadWithSlice()
    fireEvent.click(
      within(screen.getByRole('group', { name: enUS.skipLabel })).getByRole('button', { name: '2' }),
    )
    const region = regions.getRegions()[0]!

    await ws.play()
    vi.useFakeTimers()
    regions.emitRegionOut(region)
    vi.advanceTimersByTime(1000)
    expect(ws.getCurrentTime()).not.toBe(42)

    vi.advanceTimersByTime(400)
    expect(ws.getCurrentTime()).toBe(42)
  })

  it('空拍等待期内重复 region-out 被重入护栏忽略', async () => {
    const { ws, regions } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    await ws.play()
    vi.useFakeTimers()
    regions.emitRegionOut(region)
    regions.emitRegionOut(region)
    vi.advanceTimersByTime(10)

    expect(ws.getCurrentTime()).toBe(42)
    expect(ws.isPlaying()).toBe(true)
  })

  it('update-end 回写切片并持久化到 localStorage（§5.1）', async () => {
    const { regions } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    act(() => region.setOptions({ start: 10, end: 35 }))

    expect(JSON.parse(localStorage.getItem('note-slice-audio-slice')!)).toEqual({
      startTime: 10,
      endTime: 35,
    })
    expect(screen.getByText(enUS.loopChipLabel(25))).toBeInTheDocument()
  })

  it('双击 region 移除切片并清除持久化', async () => {
    const { regions } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    regions.emitRegionDoubleClicked(region)

    await waitFor(() => expect(screen.queryByText(/LOOP|循环/)).not.toBeInTheDocument())
    expect(localStorage.getItem('note-slice-audio-slice')).toBeNull()
    expect(screen.queryByText(enUS.loopRange('0:42', '1:05'))).not.toBeInTheDocument()
  })

  it('双触（pointer 双击）切片区间内移除切片：iOS/iPadOS 无原生 dblclick 的触控路径', async () => {
    await loadWithSlice()
    stubStageRect(100)

    // 落点 26px → 26/100 × 204s ≈ 53s ∈ [42, 65]
    const stage = document.querySelector('[data-wave-stage]')!
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 26 })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 26 })

    await waitFor(() => expect(screen.queryByText(/LOOP|循环/)).not.toBeInTheDocument())
    expect(localStorage.getItem('note-slice-audio-slice')).toBeNull()
  })

  it('双触切片区间外不删除', async () => {
    await loadWithSlice()
    stubStageRect(100)

    // 落点 5px → 10.2s < 切片起点 42s
    const stage = document.querySelector('[data-wave-stage]')!
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 5 })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 5 })

    expect(screen.getByText(enUS.loopChipLabel(23))).toBeInTheDocument()
    expect(localStorage.getItem('note-slice-audio-slice')).not.toBeNull()
  })

  it('过短切片不恢复 region（F10：<0.05s 拒绝循环）', async () => {
    localStorage.setItem('note-slice-audio-slice', JSON.stringify({ startTime: 5, endTime: 5.01 }))
    await saveAudioFile({ fileName: 'song.mp3', fileSize: 8, data: new ArrayBuffer(8) })
    renderAudioPage()
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions } = latestPage()
    ws.emitReady(204)

    // 过短切片未恢复 region
    expect(regions.getRegions()).toHaveLength(0)
  })

  it('播放键：有切片从切片起点播；停止键归零', async () => {
    const { ws } = await loadWithSlice()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${enUS.play}$`) }))
    expect(ws.getCurrentTime()).toBe(42)
    expect(ws.isPlaying()).toBe(true)

    // 播放中 toggle 语义变为「停止」，另有专用停止键：取第二个（TransportButtons 顺序：toggle → stop）
    const stopButton = screen.getAllByRole('button', { name: new RegExp(`^${enUS.stop}$`) }).at(-1)!
    fireEvent.click(stopButton)
    expect(ws.isPlaying()).toBe(false)
    expect(ws.getCurrentTime()).toBe(0)
  })

  it('页面隐藏即暂停循环（visibilitychange，A8 最小正确解）', async () => {
    const { ws } = await loadWithSlice()
    await ws.play()
    expect(ws.isPlaying()).toBe(true)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(ws.isPlaying()).toBe(false)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('移除音频：回空态、删除 IndexedDB 行、清除切片持久化', async () => {
    await loadWithSlice()

    fireEvent.click(screen.getByRole('button', { name: enUS.removeAudio }))

    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    expect(await listAudioFiles()).toHaveLength(0)
    expect(localStorage.getItem('note-slice-audio-slice')).toBeNull()
  })

  it('解码失败（wavesurfer error）：报 errorAudioDecode（第二道闸）', async () => {
    renderAudioPage()
    await importViaInput(importAudioFile('broken.mp3'))
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws } = latestPage()

    ws.emitError('decode failed')

    expect(await screen.findByRole('alert')).toHaveTextContent(enUS.errorAudioDecode)
  })
})

describe('OriginalAudioPage 拖放导入', () => {
  it('drop 合法音频：入 IndexedDB 并创建 wavesurfer', async () => {
    const { container } = renderAudioPage()
    const pageRoot = container.firstElementChild!

    fireEvent.drop(pageRoot, { dataTransfer: { files: [importAudioFile('dropped.mp3')] } })

    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    expect((await listAudioFiles()).map((record) => record.fileName)).toEqual(['dropped.mp3'])
    expect(screen.getByText('dropped.mp3')).toBeInTheDocument()
  })

  it('drop 非法文件：报 errorUnsupportedAudio、不建 wavesurfer、不入库', async () => {
    const { container } = renderAudioPage()
    const pageRoot = container.firstElementChild!

    fireEvent.drop(pageRoot, {
      dataTransfer: { files: [new File(['plain'], 'notes.txt', { type: 'text/plain' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(enUS.errorUnsupportedAudio)
    expect(FakeWaveSurfer.all).toHaveLength(0)
    expect(await listAudioFiles()).toHaveLength(0)
  })

  it('dragover 高亮（data-drag-active）；dragleave / drop 清除', async () => {
    const { container } = renderAudioPage()
    const pageRoot = container.firstElementChild!

    expect(pageRoot).not.toHaveAttribute('data-drag-active')
    fireEvent.dragOver(pageRoot)
    expect(pageRoot).toHaveAttribute('data-drag-active', 'true')

    fireEvent.dragLeave(pageRoot)
    expect(pageRoot).not.toHaveAttribute('data-drag-active')

    fireEvent.dragOver(pageRoot)
    fireEvent.drop(pageRoot, { dataTransfer: { files: [importAudioFile('dropped.mp3')] } })
    expect(pageRoot).not.toHaveAttribute('data-drag-active')
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
  })

  it('已装载态 drop 替换当前音频，不继承旧切片', async () => {
    await loadWithSlice()
    // 已装载分支：隐藏 input 是页面根节点的直接子元素
    const pageRoot = document.querySelector('input[type="file"]')!.parentElement!

    fireEvent.drop(pageRoot, { dataTransfer: { files: [importAudioFile('replaced.ogg', 'audio/ogg')] } })

    await screen.findByText('replaced.ogg')
    expect(FakeWaveSurfer.all).toHaveLength(2)
    expect(FakeRegionsPlugin.all.at(-1)!.getRegions()).toHaveLength(0)
    expect(localStorage.getItem('note-slice-audio-slice')).toBeNull()
  })
})

describe('OriginalAudioPage 波形缩放', () => {
  it('ready 后渲染缩放控件：倍率 100%、zoom 未调用、ZoomPlugin 已注册且上限 2000px/s', async () => {
    const { ws } = await loadWithSlice()
    stubStageWidth(1000)

    expect(FakeZoomPlugin.all).toHaveLength(1)
    expect(FakeZoomPlugin.all[0]!.options.maxZoom).toBe(ZOOM_MAX_PX_PER_SEC)
    expect(screen.getByRole('button', { name: enUS.zoomIn })).toBeEnabled()
    expect(screen.getByRole('button', { name: enUS.zoomOut })).toBeDisabled()
    expect(screen.getByRole('button', { name: enUS.zoomFit })).toHaveTextContent('100%')
    expect(ws.zoomCalls).toHaveLength(0)
  })

  it('＋ 放大：以适应宽度为基准逐级倍增（fit≈4.9 → 9.8 → 19.6）', async () => {
    const { ws } = await loadWithSlice()
    stubStageWidth(1000)
    const zoomIn = screen.getByRole('button', { name: enUS.zoomIn })

    fireEvent.click(zoomIn)

    expect(ws.zoomCalls[0]).toBeCloseTo((1000 / 204) * 2, 6)
    expect(screen.getByRole('button', { name: enUS.zoomFit })).toHaveTextContent('200%')

    fireEvent.click(zoomIn)

    expect(ws.zoomCalls[1]).toBeCloseTo((1000 / 204) * 4, 6)
    expect(screen.getByRole('button', { name: enUS.zoomFit })).toHaveTextContent('400%')
    expect(screen.getByRole('button', { name: enUS.zoomOut })).toBeEnabled()
  })

  it('− 缩小：基准折半、不低于适应宽度；回到适应宽度后禁用', async () => {
    const { ws } = await loadWithSlice()
    stubStageWidth(1000)
    const zoomIn = screen.getByRole('button', { name: enUS.zoomIn })
    const zoomOut = screen.getByRole('button', { name: enUS.zoomOut })
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)

    fireEvent.click(zoomOut)
    expect(ws.zoomCalls[2]).toBeCloseTo((1000 / 204) * 2, 6)

    fireEvent.click(zoomOut)
    expect(ws.zoomCalls[3]).toBeCloseTo(1000 / 204, 6)
    expect(screen.getByRole('button', { name: enUS.zoomFit })).toHaveTextContent('100%')
    expect(zoomOut).toBeDisabled()
  })

  it('倍率按钮 = 适应窗口（回 fit，滚轮缩放到非整倍率也能归位）', async () => {
    const { ws } = await loadWithSlice()
    stubStageWidth(1000)
    fireEvent.click(screen.getByRole('button', { name: enUS.zoomIn }))

    fireEvent.click(screen.getByRole('button', { name: enUS.zoomFit }))

    expect(ws.zoomCalls.at(-1)).toBeCloseTo(1000 / 204, 6)
    expect(screen.getByRole('button', { name: enUS.zoomFit })).toHaveTextContent('100%')
  })

  it('连续放大钳到上限 2000px/s，随后 ＋ 禁用', async () => {
    const { ws } = await loadWithSlice()
    stubStageWidth(1000)
    const zoomIn = screen.getByRole('button', { name: enUS.zoomIn })

    for (let step = 0; step < 12; step += 1) fireEvent.click(zoomIn)

    expect(ws.zoomCalls.at(-1)).toBe(ZOOM_MAX_PX_PER_SEC)
    expect(zoomIn).toBeDisabled()
  })
})
