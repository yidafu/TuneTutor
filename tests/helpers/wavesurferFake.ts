/**
 * wavesurfer.js v7 测试替身（与 tests 内 vi.mock 工厂配套）。
 * 独立模块以便多个测试文件以相同形状注册 mock：
 *   vi.mock('wavesurfer.js', async () => { const m = await import('<rel>/helpers/wavesurferFake'); return { default: { create: m.FakeWaveSurfer.create } } })
 * 事件手动 emit：loadBlob 只记录 Blob，ready/error 等由测试按序触发，时序完全确定。
 */

type Handler = (...args: unknown[]) => void

class FakeEmitter {
  readonly handlers = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event)
    if (set === undefined) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event)
    if (set !== undefined) for (const handler of [...set]) handler(...args)
  }
}

export class FakeRegion extends FakeEmitter {
  static all: FakeRegion[] = []

  id: string
  start: number
  end: number
  color?: string
  removed = false
  /** 真实插件构造时即建 DOM 元素；替身只带 style 袋，供 pointerEvents 之类的断言 */
  readonly element: { style: Record<string, string> } = { style: {} }

  constructor(params: { start: number; end?: number; color?: string; [key: string]: unknown }) {
    super()
    this.id = String(params.id ?? `region-${FakeRegion.all.length + 1}`)
    this.start = params.start
    this.end = params.end ?? params.start
    this.color = params.color
    FakeRegion.all.push(this)
  }

  setOptions(options: { start?: number; end?: number; color?: string }): void {
    if (options.start !== undefined) this.start = options.start
    if (options.end !== undefined) this.end = options.end
    if (options.color !== undefined) this.color = options.color
    this.emit('update')
    this.emit('update-end')
  }

  remove(): void {
    this.removed = true
    this.emit('remove')
  }

  static reset(): void {
    FakeRegion.all = []
  }
}

export class FakeRegionsPlugin extends FakeEmitter {
  static all: FakeRegionsPlugin[] = []

  regions: FakeRegion[] = []
  dragSelectionOptions: Record<string, unknown> | null = null

  static create(): FakeRegionsPlugin {
    const plugin = new FakeRegionsPlugin()
    FakeRegionsPlugin.all.push(plugin)
    return plugin
  }

  addRegion(params: { start: number; end?: number; [key: string]: unknown }): FakeRegion {
    const region = new FakeRegion(params)
    // 真实插件：region.remove() 会广播 region-removed
    region.on('remove', () => this.emitRegionRemoved(region))
    this.regions.push(region)
    this.emit('region-created', region)
    return region
  }

  getRegions(): FakeRegion[] {
    return this.regions
  }

  enableDragSelection(options: Record<string, unknown>): () => void {
    this.dragSelectionOptions = options
    return () => {
      this.dragSelectionOptions = null
    }
  }

  clearRegions(): void {
    this.regions = []
  }

  /** region.remove() 后由测试/实现经此广播（真实插件在 region-removed 事件里广播） */
  emitRegionRemoved(region: FakeRegion): void {
    this.regions = this.regions.filter((candidate) => candidate !== region)
    this.emit('region-removed', region)
  }

  emitRegionOut(region: FakeRegion): void {
    this.emit('region-out', region)
  }

  emitRegionDoubleClicked(region: FakeRegion): void {
    this.emit('region-double-clicked', region)
  }

  static reset(): void {
    FakeRegionsPlugin.all = []
  }
}

/** 官方 ZoomPlugin（滚轮/捏合缩放）的替身：仅记录 options，交互不进单测 */
export class FakeZoomPlugin {
  static all: FakeZoomPlugin[] = []

  options: Record<string, unknown>

  constructor(options?: Record<string, unknown>) {
    this.options = options ?? {}
    FakeZoomPlugin.all.push(this)
  }

  static create(options?: Record<string, unknown>): FakeZoomPlugin {
    return new FakeZoomPlugin(options)
  }

  static reset(): void {
    FakeZoomPlugin.all = []
  }
}

export class FakeWaveSurfer extends FakeEmitter {
  static all: FakeWaveSurfer[] = []

  options: Record<string, unknown>
  blob: Blob | null = null
  loadBlobCalls = 0
  setOptionsCalls: Record<string, unknown>[] = []
  destroyed = false
  duration = 204
  decodedSampleRate = 44100
  playingState = false
  time = 0
  zoomCalls: number[] = []
  registeredPlugins: unknown[] = []
  /** 真实 v7 的 DOM 层级：container(host) > shadow > scroll > wrapper；替身建等价的
   *  scroll/wrapper 二层（游离节点，事件可派发），页面代码经 getWrapper().parentElement
   *  拿 scroll 容器挂双指平移监听（v2.10） */
  readonly scrollEl: HTMLDivElement
  private readonly wrapperEl: HTMLDivElement

  constructor(options: Record<string, unknown>) {
    super()
    this.options = options
    const wrapper = document.createElement('div')
    const scroll = document.createElement('div')
    scroll.appendChild(wrapper)
    this.wrapperEl = wrapper
    this.scrollEl = scroll
    FakeWaveSurfer.all.push(this)
  }

  getWrapper(): HTMLDivElement {
    return this.wrapperEl
  }

  static create(options: Record<string, unknown>): FakeWaveSurfer {
    return new FakeWaveSurfer(options)
  }

  registerPlugin<T>(plugin: T): T {
    this.registeredPlugins.push(plugin)
    return plugin
  }

  loadBlob(blob: Blob): Promise<void> {
    this.loadBlobCalls += 1
    this.blob = blob
    return Promise.resolve()
  }

  setTime(time: number): void {
    this.time = time
  }

  /** 与核心同语义：记录 pxPerSec、写入 options 并广播 zoom 事件（真实核心 zoom() 的行为） */
  zoom(minPxPerSec: number): void {
    this.zoomCalls.push(minPxPerSec)
    this.options.minPxPerSec = minPxPerSec
    this.emit('zoom', minPxPerSec)
  }

  getCurrentTime(): number {
    return this.time
  }

  getDuration(): number {
    return this.duration
  }

  getDecodedData(): { sampleRate: number } | null {
    return this.blob === null ? null : { sampleRate: this.decodedSampleRate }
  }

  async play(): Promise<void> {
    this.playingState = true
    this.emit('play')
  }

  pause(): void {
    this.playingState = false
    this.emit('pause')
  }

  isPlaying(): boolean {
    return this.playingState
  }

  stop(): void {
    this.playingState = false
    this.time = 0
    this.emit('pause')
  }

  setOptions(options: Record<string, unknown>): void {
    this.setOptionsCalls.push(options)
    Object.assign(this.options, options)
  }

  destroy(): void {
    this.destroyed = true
    this.emit('destroy')
  }

  /** 模拟解码完成（真实 wavesurfer 在 loadBlob 解码后 emit ready(duration)） */
  emitReady(duration = this.duration): void {
    this.duration = duration
    this.emit('ready', duration)
  }

  emitError(message: string): void {
    this.emit('error', new Error(message))
  }

  static reset(): void {
    FakeWaveSurfer.all = []
  }
}
