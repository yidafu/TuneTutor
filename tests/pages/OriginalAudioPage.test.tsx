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
// 图标是叶子组件、有自己的专属测试（tests/components/icons/）；页面测试只断言页面逻辑，
// mock 掉以免皮肤图标系统内部重构（geometry/sets）震荡传导到本文件
vi.mock('@/components/icons/ThemeIcon', () => ({
  ThemeIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}))
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

/** 切片持久化键按音频归属（A16） */
function sliceKey(audioId: string): string {
  return `note-slice-audio-slice:${audioId}`
}

async function importViaInput(file: File) {
  const input = document.querySelector('input[type="file"]')!
  fireEvent.change(input, { target: { files: [file] } })
}

function latestPage(): { ws: FakeWaveSurfer; regions: FakeRegionsPlugin; playedRegions: FakeRegionsPlugin } {
  const ws = FakeWaveSurfer.all.at(-1)!
  // 页面按序注册两个 RegionsPlugin：第一个管切片约束/循环，第二个挂已播段（A15 补强）
  const regions = FakeRegionsPlugin.all.at(-2)!
  const playedRegions = FakeRegionsPlugin.all.at(-1)!
  return { ws, regions, playedRegions }
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

/** 走「启动恢复」路径装载：导入路径会清空旧切片（新音频不继承切片）。
 *  切片故意写旧全局键：顺带验证 A16 的启动迁移（迁到恢复音频名下）。 */
async function loadWithSlice() {
  localStorage.setItem('note-slice-audio-slice', JSON.stringify({ startTime: 42, endTime: 65 }))
  const saved = await saveAudioFile({ fileName: 'song.mp3', fileSize: 8, data: new ArrayBuffer(8) })
  renderAudioPage()
  await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
  const { ws, regions, playedRegions } = latestPage()
  ws.emitReady(204)
  await screen.findByText(/3:24/)
  return { ws, regions, playedRegions, audioId: saved.id }
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

  it('update-end 回写切片并持久化（§5.1，键按音频归属 A16）', async () => {
    const { ws, regions, audioId } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    act(() => region.setOptions({ start: 10, end: 35 }))

    expect(JSON.parse(localStorage.getItem(sliceKey(audioId))!)).toEqual({
      startTime: 10,
      endTime: 35,
    })
    // 旧全局键已迁移走
    expect(localStorage.getItem('note-slice-audio-slice')).toBeNull()
    expect(screen.getByText(enUS.loopChipLabel(25))).toBeInTheDocument()
    expect(ws.options.autoScroll).toBe(false)
  })

  it('拖选新建切片（region-created）即生效并持久化，播放键从切片起点播', async () => {
    // 真实插件拖选松手只发 region-created（7.12.11 saveRegion），新建 region 没有初始
    // update-end——切片状态必须在创建时同步，否则首次拖选后播放从 0 开始
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)
    const audioId = (await listAudioFiles())[0]!.id

    act(() => regions.addRegion({ start: 30, end: 60 }))

    expect(screen.getByText(enUS.loopChipLabel(30))).toBeInTheDocument()
    expect(screen.getByText(enUS.loopRange('0:30', '1:00'))).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(sliceKey(audioId))!)).toEqual({ startTime: 30, endTime: 60 })

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${enUS.play}$`) }))
    expect(ws.getCurrentTime()).toBe(30)
    expect(ws.isPlaying()).toBe(true)
  })

  it('二次拖选替换旧切片：单切片约束，状态与持久化以新 region 为准', async () => {
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)
    const audioId = (await listAudioFiles())[0]!.id

    act(() => {
      regions.addRegion({ start: 30, end: 60 })
      regions.addRegion({ start: 5, end: 20 })
    })

    expect(regions.getRegions()).toHaveLength(1)
    expect(regions.getRegions()[0]!.start).toBe(5)
    expect(JSON.parse(localStorage.getItem(sliceKey(audioId))!)).toEqual({ startTime: 5, endTime: 20 })
    expect(screen.getByText(enUS.loopChipLabel(15))).toBeInTheDocument()
  })

  it('播放头跟随（A14）：存在切片关闭 autoScroll，移除切片恢复官方默认', async () => {
    const { ws, regions } = await loadWithSlice()
    // 恢复的切片已同步关闭自动跟随
    expect(ws.options.autoScroll).toBe(false)

    regions.emitRegionDoubleClicked(regions.getRegions()[0]!)

    await waitFor(() => expect(ws.options.autoScroll).toBe(true))
  })

  it('播放头跟随（A14）：无切片全曲播放保留官方默认跟随（长音频不丢播放头）', async () => {
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)

    // 页面未写 autoScroll → 真实 wavesurfer 默认 true
    expect(ws.options.autoScroll ?? true).toBe(true)
  })

  it('双击 region 移除切片并清除持久化', async () => {
    const { regions, audioId } = await loadWithSlice()
    const region = regions.getRegions()[0]!

    regions.emitRegionDoubleClicked(region)

    await waitFor(() => expect(screen.queryByText(/LOOP|循环/)).not.toBeInTheDocument())
    expect(localStorage.getItem(sliceKey(audioId))).toBeNull()
    expect(screen.queryByText(enUS.loopRange('0:42', '1:05'))).not.toBeInTheDocument()
  })

  it('双触（pointer 双击）切片区间内移除切片：iOS/iPadOS 无原生 dblclick 的触控路径', async () => {
    const { audioId } = await loadWithSlice()
    stubStageRect(100)

    // 落点 26px → 26/100 × 204s ≈ 53s ∈ [42, 65]
    const stage = document.querySelector('[data-wave-stage]')!
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 26 })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 26 })

    await waitFor(() => expect(screen.queryByText(/LOOP|循环/)).not.toBeInTheDocument())
    expect(localStorage.getItem(sliceKey(audioId))).toBeNull()
  })

  it('双触切片区间外不删除', async () => {
    const { audioId } = await loadWithSlice()
    stubStageRect(100)

    // 落点 5px → 10.2s < 切片起点 42s
    const stage = document.querySelector('[data-wave-stage]')!
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 5 })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 5 })

    expect(screen.getByText(enUS.loopChipLabel(23))).toBeInTheDocument()
    expect(localStorage.getItem(sliceKey(audioId))).not.toBeNull()
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

  it('播放键：有切片从切片起点播；播放中再按同键暂停在原位（单按钮切换）', async () => {
    const { ws } = await loadWithSlice()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${enUS.play}$`) }))
    expect(ws.getCurrentTime()).toBe(42)
    expect(ws.isPlaying()).toBe(true)

    // 播放中 toggle 语义变为「停止」，单按钮切换即暂停，不回卷
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${enUS.stop}$`) }))
    expect(ws.isPlaying()).toBe(false)
    expect(ws.getCurrentTime()).toBe(42)
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

  it('移除音频：回空态、删除 IndexedDB 行与该音频的切片键', async () => {
    const { audioId } = await loadWithSlice()

    fireEvent.click(screen.getByRole('button', { name: enUS.removeAudio }))

    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    expect(await listAudioFiles()).toHaveLength(0)
    expect(localStorage.getItem(sliceKey(audioId))).toBeNull()
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

  it('已装载态 drop 替换当前音频，不继承旧切片；旧音频的切片键保留（A16 归属隔离）', async () => {
    const { audioId } = await loadWithSlice()
    // 已装载分支：隐藏 input 是页面根节点的直接子元素
    const pageRoot = document.querySelector('input[type="file"]')!.parentElement!

    fireEvent.drop(pageRoot, { dataTransfer: { files: [importAudioFile('replaced.ogg', 'audio/ogg')] } })

    await screen.findByText('replaced.ogg')
    expect(FakeWaveSurfer.all).toHaveLength(2)
    expect(FakeRegionsPlugin.all.at(-2)!.getRegions()).toHaveLength(0)
    // 旧音频切片不丢：切回（经音频库）可恢复
    expect(JSON.parse(localStorage.getItem(sliceKey(audioId))!)).toEqual({ startTime: 42, endTime: 65 })
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

  it('双指平移（v2.10）：双指中心位移推动 scrollLeft（跟手反向），单指不动作，抬起复位基准', async () => {
    const { ws } = await loadWithSlice()
    const scrollEl = ws.scrollEl
    scrollEl.scrollLeft = 0

    // 首帧只记基准中心（x=500），不平移
    fireEvent.touchMove(scrollEl, {
      touches: [
        { clientX: 450, identifier: 1 },
        { clientX: 550, identifier: 2 },
      ],
    })
    expect(scrollEl.scrollLeft).toBe(0)

    // 双指同向右移 60px（中心 500 → 560）：内容随手右移 = scrollLeft 减少 60
    fireEvent.touchMove(scrollEl, {
      touches: [
        { clientX: 510, identifier: 1 },
        { clientX: 610, identifier: 2 },
      ],
    })
    expect(scrollEl.scrollLeft).toBe(-60)

    // 单指触摸：重置基准（不产生平移）
    fireEvent.touchMove(scrollEl, { touches: [{ clientX: 300, identifier: 1 }] })
    expect(scrollEl.scrollLeft).toBe(-60)

    // 抬起后再落双指：从新基准起算，不叠加跳变
    fireEvent.touchEnd(scrollEl)
    fireEvent.touchMove(scrollEl, {
      touches: [
        { clientX: 400, identifier: 3 },
        { clientX: 500, identifier: 4 },
      ],
    })
    fireEvent.touchMove(scrollEl, {
      touches: [
        { clientX: 415, identifier: 3 },
        { clientX: 515, identifier: 4 },
      ],
    })
    expect(scrollEl.scrollLeft).toBe(-75)
  })
})

describe('OriginalAudioPage 进度高亮域（A15）', () => {
  /** themeColor 走 getComputedStyle，jsdom 返回空串：钉假 token 值验证配色规则 */
  const FAKE_TOKENS: Record<string, string> = {
    '--color-wave-bar-a': '#b9ae8d',
    '--color-verm': '#c8451f',
    '--color-gold-bright': '#d9a441',
  }

  function stubThemeTokens(): void {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) => FAKE_TOKENS[name] ?? '',
    } as unknown as CSSStyleDeclaration)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('有切片：进度层退化为波形色（[0, 播放头] 不再越界涂色），高亮只来自切片 region', async () => {
    stubThemeTokens()
    const { ws } = await loadWithSlice()

    expect(ws.options.progressColor).toBe(FAKE_TOKENS['--color-wave-bar-a'])
    expect(ws.options.waveColor).toBe(FAKE_TOKENS['--color-wave-bar-a'])
  })

  it('移除切片：进度层恢复朱砂双层进度', async () => {
    stubThemeTokens()
    const { ws, regions } = await loadWithSlice()

    regions.emitRegionDoubleClicked(regions.getRegions()[0]!)

    await waitFor(() => expect(ws.options.progressColor).toBe(FAKE_TOKENS['--color-verm']))
  })

  it('无切片：朱砂双层进度保持默认', async () => {
    stubThemeTokens()
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)

    expect(ws.options.progressColor).toBe(FAKE_TOKENS['--color-verm'])
  })

  it('已播段（A15 补强）：播放头进切片 → 第二实例出现 [起点, 播放头] 深朱砂 region，不挡指针', async () => {
    stubThemeTokens()
    const { ws, playedRegions } = await loadWithSlice()

    act(() => ws.emit('timeupdate', 50))

    const played = playedRegions.getRegions()
    expect(played).toHaveLength(1)
    expect(played[0]!.start).toBe(42)
    expect(played[0]!.end).toBe(50)
    expect(played[0]!.color).toBe(`${FAKE_TOKENS['--color-verm']}59`)
    expect(played[0]!.element.style.pointerEvents).toBe('none')
  })

  it('已播段：播放头越过切片终点（容差内，region-out/空拍停留）钳到终点；回卷到起点即移除', async () => {
    stubThemeTokens()
    const { ws, playedRegions } = await loadWithSlice()

    // 65.3s = 终点 65 + 0.3s < PLAYED_TAIL_TOLERANCE_SEC(0.5)：循环出界的正常停留
    act(() => ws.emit('timeupdate', 65.3))
    expect(playedRegions.getRegions()[0]!.end).toBe(65)

    act(() => ws.emit('timeupdate', 42))
    expect(playedRegions.getRegions()).toHaveLength(0)
  })

  it('已播段越位（v2.10）：播放头越过切片尾超过容差（seek 远处）不再整段深红', async () => {
    stubThemeTokens()
    const { ws, playedRegions } = await loadWithSlice()

    act(() => ws.emit('timeupdate', 50))
    expect(playedRegions.getRegions()).toHaveLength(1)

    // seek 到 100s（> 65 + 0.5）：新选区从未播放，整段深红会被误读为非选区高亮 → 移除
    act(() => ws.emit('timeupdate', 100))
    expect(playedRegions.getRegions()).toHaveLength(0)
  })

  it('已播段越位（v2.10）：新拖选的切片与播放头无关（起点在播放头之前远处）不出现整段已播', async () => {
    stubThemeTokens()
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions, playedRegions } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)

    // 播放头停在 150s（播放过全曲后暂停），再拖选 [5, 20]：与新切片无关，不建已播段
    act(() => ws.setTime(150))
    act(() => regions.addRegion({ start: 5, end: 20 }))

    expect(playedRegions.getRegions()).toHaveLength(0)
  })

  it('拖选替换零中间态（v2.10）：新 region 顶替旧 region 不经 updateSlice(null)，进度色不闪回朱砂', async () => {
    stubThemeTokens()
    renderAudioPage()
    await importViaInput(importAudioFile())
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    const { ws, regions } = latestPage()
    ws.emitReady(204)
    await screen.findByText(/3:24/)

    const callsBeforeReplace = ws.setOptionsCalls.length
    act(() => {
      regions.addRegion({ start: 30, end: 60 })
      regions.addRegion({ start: 5, end: 20 })
    })

    // 替换路径上不允许出现无切片态参数（autoScroll:true 即进度色恢复朱砂的信号）
    const replaceCalls = ws.setOptionsCalls.slice(callsBeforeReplace)
    expect(replaceCalls.some((call) => call.autoScroll === true)).toBe(false)
    // 最终态：仍以新切片为准
    expect(ws.options.autoScroll).toBe(false)
    expect(screen.getByText(enUS.loopChipLabel(15))).toBeInTheDocument()
  })

  it('已播段：播放头未进切片不出现', async () => {
    stubThemeTokens()
    const { ws, playedRegions } = await loadWithSlice()

    act(() => ws.emit('timeupdate', 10))

    expect(playedRegions.getRegions()).toHaveLength(0)
  })

  it('已播段：移除切片随之移除；切片改界后按当前播放头重新钳位', async () => {
    stubThemeTokens()
    const { ws, regions, playedRegions } = await loadWithSlice()

    act(() => ws.emit('timeupdate', 50))
    expect(playedRegions.getRegions()).toHaveLength(1)

    regions.emitRegionDoubleClicked(regions.getRegions()[0]!)
    expect(playedRegions.getRegions()).toHaveLength(0)

    // 拖出新切片 [10, 35]，播放头停在 20 → 已播段 [10, 20]
    regions.addRegion({ start: 10, end: 35 })
    const region = regions.getRegions().at(-1)!
    act(() => {
      ws.setTime(20)
      region.setOptions({ start: 10, end: 35 })
    })
    expect(playedRegions.getRegions()[0]!.start).toBe(10)
    expect(playedRegions.getRegions()[0]!.end).toBe(20)
  })
})

describe('OriginalAudioPage 多选导入与音频库（A16）', () => {
  it('隐藏 input 带 multiple；多选导入逐个入库，装载最后一个合法文件', async () => {
    renderAudioPage()
    const input = document.querySelector('input[type="file"]')!
    expect(input).toHaveAttribute('multiple')

    fireEvent.change(input, {
      target: {
        files: [importAudioFile('a.mp3'), importAudioFile('b.wav', 'audio/wav'), importAudioFile('c.mp3')],
      },
    })

    await screen.findByText('c.mp3')
    expect((await listAudioFiles()).map((record) => record.fileName).sort()).toEqual([
      'a.mp3',
      'b.wav',
      'c.mp3',
    ])
    expect(FakeWaveSurfer.all).toHaveLength(1)
  })

  it('drop 多文件：合法的逐个入库，非法的报错不入库', async () => {
    const { container } = renderAudioPage()
    const pageRoot = container.firstElementChild!

    fireEvent.drop(pageRoot, {
      dataTransfer: {
        files: [
          importAudioFile('a.mp3'),
          new File(['plain'], 'notes.txt', { type: 'text/plain' }),
          importAudioFile('c.ogg', 'audio/ogg'),
        ],
      },
    })

    await screen.findByText('c.ogg')
    expect((await listAudioFiles()).map((record) => record.fileName).sort()).toEqual(['a.mp3', 'c.ogg'])
    expect(screen.getByRole('alert')).toHaveTextContent(enUS.errorUnsupportedAudio)
    expect(FakeWaveSurfer.all).toHaveLength(1)
  })

  it('移除当前音频后，空态陈列最近音频，点选即装载', async () => {
    renderAudioPage()
    await importViaInput(importAudioFile('active.mp3'))
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(1))
    await saveAudioFile({ fileName: 'kept.mp3', fileSize: 8, data: new ArrayBuffer(8) })

    fireEvent.click(screen.getByRole('button', { name: enUS.removeAudio }))

    expect(screen.getByText(enUS.audioDropMain)).toBeInTheDocument()
    // 列表在删除落地后刷新（含刚入库的 kept.mp3，不含已删的 active.mp3）
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'active.mp3' })).not.toBeInTheDocument(),
    )
    expect(screen.getByText(enUS.recentAudio)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'kept.mp3' }))
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(2))
    expect(screen.getByText('kept.mp3')).toBeInTheDocument()
  })

  it('音频库弹窗：头部按钮打开、当前条目高亮、库内删除不动当前装载', async () => {
    // 先入库另一条再渲染：song.mp3 后存 → 启动恢复取 song.mp3，库列表含两条
    await saveAudioFile({ fileName: 'other.mp3', fileSize: 8, data: new ArrayBuffer(8) })
    const { audioId } = await loadWithSlice()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.audioLibraryTitle) }))

    const dialog = screen.getByRole('dialog', { name: enUS.audioLibraryTitle })
    // 库列表经 IndexedDB 异步装载（负载下有往返延迟），用 findBy 等待
    expect(await within(dialog).findByText('song.mp3')).toBeInTheDocument()
    expect(await within(dialog).findByText('other.mp3')).toBeInTheDocument()
    // 当前装载条目高亮（data-active），另一条无
    expect(within(dialog).getByText('song.mp3').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(within(dialog).getByText('other.mp3').closest('[data-active]')).toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: `${enUS.delete} other.mp3` }))

    expect(await listAudioFiles()).toHaveLength(1)
    // other.mp3 行消失；song.mp3 仍在（弹窗未关 + 装载态元信息行同文名，作用域到弹窗内断言）
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: 'other.mp3' })).not.toBeInTheDocument(),
    )
    expect(within(dialog).getByRole('button', { name: 'song.mp3' })).toBeInTheDocument()
    // 装载态元信息行仍显示当前音频名（弹窗行同文名，取全量断言非空）
    expect(screen.getAllByText('song.mp3').length).toBeGreaterThan(0)
    expect(localStorage.getItem(sliceKey(audioId))).not.toBeNull()
  })

  it('音频库切换音频：弹窗关闭、新音频不继承切片；切回后自身切片恢复', async () => {
    const { audioId } = await loadWithSlice()
    await saveAudioFile({ fileName: 'other.mp3', fileSize: 8, data: new ArrayBuffer(8) })
    const openLibrary = () =>
      fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.audioLibraryTitle) }))

    openLibrary()
    // other.mp3 在挂载后才入库：靠弹窗打开时的对账刷新出现
    fireEvent.click(await screen.findByRole('button', { name: 'other.mp3' }))

    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('other.mp3')).toBeInTheDocument()
    // other.mp3 名下无切片键：不继承 song.mp3 的切片
    expect(FakeRegionsPlugin.all.at(-2)!.getRegions()).toHaveLength(0)
    // song.mp3 的切片键保留
    expect(JSON.parse(localStorage.getItem(sliceKey(audioId))!)).toEqual({ startTime: 42, endTime: 65 })

    openLibrary()
    fireEvent.click(await screen.findByRole('button', { name: 'song.mp3' }))
    await waitFor(() => expect(FakeWaveSurfer.all).toHaveLength(3))

    FakeWaveSurfer.all.at(-1)!.emitReady(204)
    await waitFor(() => expect(FakeRegionsPlugin.all.at(-2)!.getRegions()).toHaveLength(1))
    expect(FakeRegionsPlugin.all.at(-2)!.getRegions()[0]!.start).toBe(42)
    expect(screen.getByText(enUS.loopChipLabel(23))).toBeInTheDocument()
  })

  it('音频库弹窗打开时全局快捷键停用：Space 不触发播放，Esc 只关弹窗', async () => {
    const { ws } = await loadWithSlice()
    await saveAudioFile({ fileName: 'other.mp3', fileSize: 8, data: new ArrayBuffer(8) })

    fireEvent.click(screen.getByRole('button', { name: new RegExp(enUS.audioLibraryTitle) }))
    expect(screen.getByRole('dialog', { name: enUS.audioLibraryTitle })).toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space' })
    expect(ws.isPlaying()).toBe(false)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
