import { useCallback, useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import ScoreSelectionOverlay from './ScoreSelectionOverlay'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useI18n } from '../locales/useI18n'
import { useTheme } from '../hooks/useTheme'
import type { PlaybackEngine } from '../audio/PlaybackEngine'
import { buildPlaybackData } from '../audio/playbackData'
import type { PlaybackEntry } from '../types/playback'
import {
  NoteInteraction,
  hitNoteFromPosition,
  type NotePosition,
} from '../utils/notation/NoteInteraction'
import {
  buildRowGeometries,
  computeBoxSelection,
  type DragRect,
  type RowGeometry,
} from '../utils/notation/layout'
import { OsmdRender, nextZoomStep, ZOOM_MAX, ZOOM_MIN } from '../utils/notation/OsmdRender'
import {
  PINCH_MIN_SPAN_PX,
  PINCH_ZOOM_EPSILON,
  anchoredScrollLeft,
  clampedScroll,
  pinchMidpoint,
  pinchSpan,
  targetPinchZoom,
  type PinchPoint,
} from '../utils/notation/pinchZoom'
import {
  applyBoxModifiers,
  createBoxSelection,
  createMeasureSelection,
  createPhraseSelection,
  DRAG_SLOP_PX,
  PENDING_DESTROY_MS,
  summarizeSelection,
  type HitNote,
  type ScoreSelection,
  type SelectionSummary,
} from '../utils/notation/selection'

const styles = stylex.create({
  stage: {
    position: 'relative',
    marginTop: '8px',
    display: 'grid',
    minHeight: '160px',
    flex: 1,
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-wash)',
    paddingInline: '24px',
  },
  stageLoaded: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingInline: 0,
    // 拖拽面（selection.md §4.2/S5）：不给滚动接管手势的机会，pointermove 才不会停发
    touchAction: 'none',
    cursor: 'default',
    overflow: 'auto',
  },
  placeholder: {
    maxWidth: '420px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--color-fg-3)',
  },
  osmdContainer: {
    width: '100%',
  },
  // 覆盖层锚定盒（selection.md §5/S4 坐标契约）：与 osmdContainer 同原点的相对定位层。
  // stage 是垂直居中的 grid，覆盖层若直接挂在 stage 上，坐标会随卡面高度漂移
  // （播放光标带悬空在谱表上方，2026-10-18 实测）；全部覆盖层视觉必须挂在这里。
  sheetBox: {
    position: 'relative',
    width: '100%',
  },
  footer: {
    marginTop: '14px',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    paddingTop: '10px',
    fontSize: '11.5px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-ink-2)',
  },
  zoomRow: {
    display: 'inline-flex',
    gap: '4px',
  },
  zoomChip: {
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-3)',
    paddingInline: '8px',
    paddingBlock: '2px',
    color: 'var(--color-fg-2)',
  },
  zoomBtn: {
    borderWidth: 0,
    fontSize: '12px',
    lineHeight: '16px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--color-surface-2)',
      color: 'var(--color-fg)',
    },
    // 触控专项（PRD G12）：页脚缩放钮触屏下加大命中面
    '@media (pointer: coarse)': {
      fontSize: '14px',
      lineHeight: '20px',
      paddingInline: '12px',
      paddingBlock: '10px',
    },
  },
})

interface OsmdNotationProps {
  /** 解包后的主谱 XML 原文（processFile 产物）；undefined = 未加载 */
  rawContent?: string
  /** 会话态选择（ScorePage 持有；清除按钮/换谱时被置 null） */
  selection: ScoreSelection | null
  /** 任何一次交互产生的新选择（null = 清除），连同展示摘要一并上报 */
  onSelectionChange: (selection: ScoreSelection | null, summary: SelectionSummary | null) => void
  /** 选择无法落成有效区间（如洞小节无可定位音符）时的 UI 提示钩子 */
  onSelectionInvalid: () => void
  /** 外部清零信号（Esc/清除按钮）：递增即销毁内部 pending 意图 */
  clearPendingSignal?: number
  /** 播放引擎（usePlayback 持有）；非空时订阅 iteration/state 事件驱动播放光标带（audio.md §3.8） */
  engine?: PlaybackEngine | null
  /** 新谱装载完成后上报播放数据（乐谱时域条目）与谱键 rawContent（P3 接线 §3.2） */
  onPlaybackDataReady?: (entries: PlaybackEntry[], scoreKey: string) => void
}

type Gesture =
  | { kind: 'candidate'; pointerId: number; x0: number; y0: number; note: NotePosition | null }
  | {
      kind: 'box'
      pointerId: number
      x0: number
      y0: number
      x1: number
      y1: number
      /** 容器原点（起板帧缓存一次）：拖拽中的矩形换算零 getBoundingClientRect */
      originX: number
      originY: number
      shift: boolean
      ctrlOrMeta: boolean
    }
  | { kind: 'handle'; pointerId: number; side: 'start' | 'end' }
  | { kind: 'cancelled'; pointerId: number }
  /** 双指视口手势（PRD G12）：捏合缩放 + 双指平移，不产生任何选择。target/mid 随 move 原地更新 */
  | {
      kind: 'pinch'
      pointerIds: [number, number]
      span0: number
      zoom0: number
      target: number
      midX0: number
      midY0: number
      midX: number
      midY: number
      /** sheetBox 原点（起板帧缓存）：transform-origin 与滚动锚定的视口坐标换算基准 */
      originX: number
      originY: number
      scrollLeft0: number
      scrollTop0: number
    }

type BoxGesture = Extract<Gesture, { kind: 'box' }>
type PinchGesture = Extract<Gesture, { kind: 'pinch' }>

/** 框选矩形解析结果（预览与提交共用，保证所见即所提） */
type BoxOutcome =
  | { action: 'keep' }
  | { action: 'clear' }
  | { action: 'invalid' }
  | { action: 'commit'; selection: ScoreSelection }

interface PendingStart {
  noteIndex: number
  measureIndex: number
  hit: HitNote
}

const SUPPRESS_DOUBLE_MS = 400

/** 手势 client 坐标 → 容器相对 DragRect（§5.2 坐标契约：减容器原点而非 stage） */
function gestureRect(gesture: {
  x0: number
  y0: number
  x1: number
  y1: number
  originX: number
  originY: number
}): DragRect {
  const originX = gesture.originX
  const originY = gesture.originY
  return {
    x1: Math.min(gesture.x0, gesture.x1) - originX,
    y1: Math.min(gesture.y0, gesture.y1) - originY,
    x2: Math.max(gesture.x0, gesture.x1) - originX,
    y2: Math.max(gesture.y0, gesture.y1) - originY,
  }
}

/**
 * 纸面乐谱卡渲染区 + 页脚（docs/tech.md §6.1、docs/selection.md §4）。
 * 持有 OSMD 实例与音符缓存：渲染/缩放/换肤/容器尺寸变化后全量重建；
 * 指针管线 = 原生监听（text-selection.md §6 原则 1）：单击音符选小节（零延迟）、
 * 双击两点设乐句（原生 dblclick + useDoubleTap 双路径幂等，S6）、空白拖拽框选（4px
 * slop 起板，拖拽中实时预览选中区域——橡皮筋矩形直写 style、覆盖区间变化门控进
 * state，§4.2 v1.6；抬手提交）、边界句柄微调。
 */
export default function OsmdNotation({
  rawContent,
  selection,
  onSelectionChange,
  onSelectionInvalid,
  clearPendingSignal = 0,
  engine = null,
  onPlaybackDataReady,
}: OsmdNotationProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const stageRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 覆盖层锚定盒：双指捏合时对其施加 CSS scale 预览（谱面 + 覆盖层整体缩放）
  const sheetBoxRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<OsmdRender | null>(null)
  const interactionRef = useRef<NoteInteraction | null>(null)
  const loadingRef = useRef(false)
  const gestureRef = useRef<Gesture | null>(null)
  /** 当前屏幕上的活跃指针（双指判定；up/cancel 即刻移除） */
  const activePointersRef = useRef(new Map<number, PinchPoint>())
  // 捏合中页脚倍率的合帧：60–120Hz 的 pointermove 不逐事件刷 React（同播放光标带模式）
  const pinchLabelFrameRef = useRef<number | null>(null)
  const pinchLabelTargetRef = useRef<number | null>(null)
  const pendingRef = useRef<PendingStart | null>(null)
  const pendingTimerRef = useRef<number | null>(null)
  const lastPhraseCommitRef = useRef<{ endIndex: number; at: number } | null>(null)
  const suppressDoubleRef = useRef(0)
  const dragFrameRef = useRef<number | null>(null)
  const dragLayerRef = useRef<HTMLDivElement | null>(null)
  const zoomRef = useRef(1)

  const [zoom, setZoom] = useState(1)
  const [geometry, setGeometry] = useState<{ positions: NotePosition[]; rows: RowGeometry[] } | null>(null)
  const [pendingNoteIndex, setPendingNoteIndex] = useState<number | null>(null)
  // 框选拖拽实时预览（§4.2 v1.6）：由拖拽帧按覆盖区间现算、区间变化时才更新；
  // null = 未拖拽或矩形下无可选区间（覆盖层回落 committed selection）
  const [boxPreview, setBoxPreview] = useState<ScoreSelection | null>(null)

  // 跨 render 的最新值镜像：原生监听只挂一次，回调经 ref 读最新 props/几何
  const settingsRef = useRef({ selection, onSelectionChange, onSelectionInvalid, onPlaybackDataReady })
  useEffect(() => {
    settingsRef.current = { selection, onSelectionChange, onSelectionInvalid, onPlaybackDataReady }
  })
  const geometryRef = useRef(geometry)
  useEffect(() => {
    geometryRef.current = geometry
  }, [geometry])

  const destroyPending = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    pendingRef.current = null
    setPendingNoteIndex(null)
  }, [])

  // 外部清零信号（Esc/清除按钮）→ 销毁 pending 意图；内容装载/换谱另行销毁
  const lastClearSignalRef = useRef(clearPendingSignal)
  useEffect(() => {
    if (clearPendingSignal !== lastClearSignalRef.current) {
      lastClearSignalRef.current = clearPendingSignal
      destroyPending()
    }
  }, [clearPendingSignal, destroyPending])

  /** 统一提交口：连同展示摘要一并上报（摘要由 positions 缓存现算，§2.4） */
  const commitSelection = useCallback((next: ScoreSelection | null) => {
    const summary =
      next === null ? null : summarizeSelection(next, geometryRef.current?.positions ?? [])
    settingsRef.current.onSelectionChange(next, summary)
  }, [])

  const rebuild = useCallback((renderer: OsmdRender, container: HTMLElement) => {
    const interaction = new NoteInteraction(renderer.instance, container)
    interaction.build()
    interactionRef.current = interaction
    setGeometry({
      positions: [...interaction.cachedPositions],
      rows: buildRowGeometries(interaction.cachedPositions),
    })
  }, [])

  /** 播放数据上报（P3 接线）：光标步进构建后复位光标（构建只读数据，不复位会停在谱尾） */
  const emitPlaybackData = useCallback((renderer: OsmdRender, scoreKey: string) => {
    const report = settingsRef.current.onPlaybackDataReady
    if (report === undefined) return
    const cursor = renderer.instance.cursor
    const built = buildPlaybackData(cursor)
    cursor.reset()
    report(built, scoreKey)
  }, [])

  // ── 播放光标（audio.md §3.8 契约；视觉由 ScoreSelectionOverlay 的金铜带承载）────
  // 引擎迭代器指针直读 → playingNoteIndex；同帧多次 iteration 以 rAF 合并（取最新指针）。
  // 视觉活在覆盖层：重渲染/回跳无需 OSMD 光标重同步；OSMD 自带光标仅装载时遍历播放
  // 数据用（buildPlaybackData），从不 show（其颜色经 canvas 导出 PNG、高度锁死谱表内）。

  const [playingNoteIndex, setPlayingNoteIndex] = useState<number | null>(null)
  const playheadTargetRef = useRef<number | null>(null)
  const playheadFrameRef = useRef<number | null>(null)
  const playheadFrameIsRafRef = useRef(false)

  useEffect(() => {
    if (engine === null) return
    const cancelFrame = (): void => {
      if (playheadFrameRef.current === null) return
      if (playheadFrameIsRafRef.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(playheadFrameRef.current)
      } else {
        window.clearTimeout(playheadFrameRef.current)
      }
      playheadFrameRef.current = null
    }
    const flush = (): void => {
      playheadFrameRef.current = null
      setPlayingNoteIndex(playheadTargetRef.current)
    }
    const schedule = (): void => {
      if (playheadFrameRef.current !== null) return
      if (typeof requestAnimationFrame === 'function') {
        playheadFrameIsRafRef.current = true
        playheadFrameRef.current = requestAnimationFrame(flush)
      } else {
        playheadFrameIsRafRef.current = false
        playheadFrameRef.current = window.setTimeout(flush, 0)
      }
    }
    const offIteration = engine.onIteration((event) => {
      // 光标带只信事件载荷（刚发声的条目），不读活指针：指针在 look-ahead 调度时刻
      // 已前进（窗口内多音、调度 tick 与 rAF 之间），按指针走会在密集段提前到下一音
      playheadTargetRef.current = event.entry?.noteIndex ?? null
      schedule()
    })
    const offState = engine.onStateChange((state) => {
      if (state === 'PLAYING') {
        playheadTargetRef.current = null
        schedule() // 先清上一轮的带；首 iteration 到来前不显示
      } else {
        playheadTargetRef.current = null
        cancelFrame()
        setPlayingNoteIndex(null) // 停止即清，不等帧
      }
    })
    return () => {
      offIteration()
      offState()
      cancelFrame()
    }
  }, [engine])

  // 内容装载：rawContent 变更即重载（幂等），换谱清选择（选择是谱内会话态，S8）。
  // 首次挂载不回调清除（选择本来为空，避免无意义的父级状态更新）。
  // 每次挂载用独立 host div 承载 OSMD：StrictMode 卸载-重挂载后，旧 renderer 的
  // load() 在途、其内部 render() 迟到执行时画进已脱离 DOM 的旧 host，不污染新渲染
  // （否则同容器双份 .vf-notehead，zip 计数守卫判失配 → 几何缓存整条降级为空）。
  const loadedContentRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const container = containerRef.current
    if (container === null || rawContent === undefined) return
    let cancelled = false
    zoomRef.current = 1
    setZoom(1)
    setGeometry(null)
    destroyPending()
    if (loadedContentRef.current !== undefined && loadedContentRef.current !== rawContent) {
      settingsRef.current.onSelectionChange(null, null)
    }
    loadedContentRef.current = rawContent
    const host = document.createElement('div')
    container.replaceChildren(host)
    const renderer = new OsmdRender(host)
    rendererRef.current = renderer
    loadingRef.current = true
    void (async () => {
      try {
        await renderer.load(rawContent)
        if (cancelled) return
        await renderer.waitForSvgContent()
        if (cancelled) return
        rebuild(renderer, host)
        emitPlaybackData(renderer, rawContent)
      } catch (error: unknown) {
        console.error('[OsmdNotation] render failed:', error)
      } finally {
        if (!cancelled) loadingRef.current = false
      }
    })()
    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [rawContent, rebuild, destroyPending, emitPlaybackData])

  /** 缩放/换肤/容器尺寸变化后的重渲染 + 缓存重建（选择保留：noteIndex 不变，§2.4） */
  const rerender = useCallback(
    async (nextZoom?: number) => {
      const renderer = rendererRef.current
      const container = containerRef.current
      if (renderer === null || container === null || loadingRef.current) return
      loadingRef.current = true
      try {
        if (nextZoom === undefined) renderer.render()
        else renderer.setZoom(nextZoom)
        await renderer.waitForSvgContent()
        rebuild(renderer, container)
      } catch (error: unknown) {
        console.error('[OsmdNotation] rerender failed:', error)
      } finally {
        loadingRef.current = false
      }
    },
    [rebuild],
  )

  const applyZoom = useCallback(
    (direction: 1 | -1) => {
      const next = nextZoomStep(zoomRef.current, direction)
      zoomRef.current = next
      setZoom(next)
      void rerender(next)
    },
    [rerender],
  )

  // 换肤触发重渲染（skin-switching.html T6）；挂载时渲染未就绪/进行中则跳过
  useEffect(() => {
    if (rendererRef.current === null || loadingRef.current) return
    void rerender()
  }, [theme, rerender])

  // 容器尺寸变化 → 防抖重渲染（autoResize 关闭：重渲染与缓存失效走同一条路，§3.2）
  useEffect(() => {
    const container = containerRef.current
    if (container === null || typeof ResizeObserver === 'undefined') return
    let timer: number | null = null
    let lastWidth: number | null = null
    const observer = new ResizeObserver((entries) => {
      const width = entries[entries.length - 1]?.contentRect.width
      if (width === undefined || width === lastWidth) return
      lastWidth = width
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void rerender()
      }, 200)
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [rerender])

  // ── 选择语义 ────────────────────────────────────────────────────────

  const handleTapSelect = useCallback(
    (note: NotePosition) => {
      // 双击第二击的让位（e2e 实测的覆盖序）：useDoubleTap 挂在 document 的 pointerdown
      // 上，先于本 up handler 运行——同一手势里它要么刚建立 pending（第一击的 down2），
      // 要么刚以本音符为终点提交乐句（第二击的 down2）。两种情形下本次 tap 都是尾巴：
      // - pending 已是同一音符 → 跳过，避免启动销毁定时器缩窄乐句窗口；
      // - 乐句刚提交 → 跳过，避免 measure 提交覆盖刚提交的乐句。
      const pendingForTap = pendingRef.current
      if (pendingForTap !== null && pendingForTap.noteIndex === note.noteIndex) return
      const lastCommit = lastPhraseCommitRef.current
      if (
        lastCommit !== null &&
        lastCommit.endIndex === note.noteIndex &&
        Date.now() - lastCommit.at < PENDING_DESTROY_MS
      ) {
        return
      }
      // 单击 = 即时选小节（零延迟，S6）；pending 不直接破坏，进入延迟销毁窗口（§4.3）
      if (pendingRef.current !== null && pendingTimerRef.current === null) {
        pendingTimerRef.current = window.setTimeout(() => destroyPending(), PENDING_DESTROY_MS)
      }
      const positions = geometryRef.current?.positions ?? []
      const next = createMeasureSelection(note.measureIndex, positions)
      if (next === null) {
        settingsRef.current.onSelectionInvalid()
        return
      }
      commitSelection(next)
    },
    [destroyPending, commitSelection],
  )

  const handlePhraseTap = useCallback(
    (note: NotePosition) => {
      const pending = pendingRef.current
      if (pending === null) {
        // 双路径去重（S6/AGENTS）：原生 dblclick 与触控双击对同一手势先后触发，
        // 刚提交的终点音符在窗口内的重复信号直接忽略
        const last = lastPhraseCommitRef.current
        if (
          last !== null &&
          last.endIndex === note.noteIndex &&
          Date.now() - last.at < PENDING_DESTROY_MS
        ) {
          return
        }
        pendingRef.current = {
          noteIndex: note.noteIndex,
          measureIndex: note.measureIndex,
          hit: hitNoteFromPosition(note),
        }
        setPendingNoteIndex(note.noteIndex)
        return
      }
      if (pending.noteIndex === note.noteIndex) return
      destroyPending()
      lastPhraseCommitRef.current = { endIndex: note.noteIndex, at: Date.now() }
      commitSelection(createPhraseSelection(pending.hit, hitNoteFromPosition(note)))
    },
    [destroyPending, commitSelection],
  )

  /** 框选矩形 → 选择产物。预览与提交共用本解析（所见即所提），修饰键语义见 applyBoxModifiers */
  const resolveBox = useCallback(
    (rect: DragRect, shift: boolean, ctrlOrMeta: boolean): BoxOutcome => {
      const geo = geometryRef.current
      if (geo === null) return { action: 'keep' }
      const box = computeBoxSelection(rect, geo.positions, geo.rows)
      if (box === null) return { action: 'keep' } // 没盖到音符：不产生选择（text-selection.md §3.4）
      const adjusted = applyBoxModifiers(settingsRef.current.selection, box, { shift, ctrlOrMeta })
      if (adjusted === null) return { action: 'clear' }
      const next = createBoxSelection(adjusted.startIndex, adjusted.endIndex, geo.positions)
      if (next === null) return { action: 'invalid' }
      return { action: 'commit', selection: next }
    },
    [],
  )

  const commitBox = useCallback(
    (rect: DragRect, shift: boolean, ctrlOrMeta: boolean) => {
      const outcome = resolveBox(rect, shift, ctrlOrMeta)
      if (outcome.action === 'commit') commitSelection(outcome.selection)
      else if (outcome.action === 'clear') commitSelection(null)
      else if (outcome.action === 'invalid') settingsRef.current.onSelectionInvalid()
    },
    [resolveBox, commitSelection],
  )

  const commitHandle = useCallback(
    (side: 'start' | 'end', clientX: number, clientY: number) => {
      const geo = geometryRef.current
      const current = settingsRef.current.selection
      const interaction = interactionRef.current
      if (geo === null || current === null || interaction === null) return
      // 句柄拖拽吸附最近音符（selection.md §9.4 Soundslice 式）
      const note = interaction.hitAtPoint(clientX, clientY)
      if (note === null || !note.occupiesSlot) return
      const bounds =
        side === 'start'
          ? { startIndex: Math.min(note.noteIndex, current.endIndex), endIndex: current.endIndex }
          : { startIndex: current.startIndex, endIndex: Math.max(note.noteIndex, current.startIndex) }
      const next = createBoxSelection(bounds.startIndex, bounds.endIndex, geo.positions)
      if (next === null) return
      commitSelection(next)
    },
    [commitSelection],
  )

  // ── 拖拽实时反馈（§4.2 v1.6）：橡皮筋矩形直写 style 不进 state；选中区域实时
  // 预览按覆盖区间变化门控进 React state（rAF 合帧，区间未变时返回原引用跳过重渲染）──

  const writeDragRect = useCallback((rect: DragRect) => {
    const layer = dragLayerRef.current
    if (layer === null) return
    layer.style.display = 'block'
    layer.style.left = `${rect.x1}px`
    layer.style.top = `${rect.y1}px`
    layer.style.width = `${rect.x2 - rect.x1}px`
    layer.style.height = `${rect.y2 - rect.y1}px`
  }, [])

  const hideDragRect = useCallback(() => {
    const layer = dragLayerRef.current
    if (layer !== null) layer.style.display = 'none'
  }, [])

  const runDragFrame = useCallback(
    (gesture: BoxGesture) => {
      dragFrameRef.current = null
      const rect = gestureRect(gesture)
      writeDragRect(rect)
      const outcome = resolveBox(rect, gesture.shift, gesture.ctrlOrMeta)
      const preview = outcome.action === 'commit' ? outcome.selection : null
      setBoxPreview((prev) =>
        prev !== null &&
        preview !== null &&
        prev.startIndex === preview.startIndex &&
        prev.endIndex === preview.endIndex
          ? prev
          : preview,
      )
    },
    [writeDragRect, resolveBox],
  )

  const scheduleDragFrame = useCallback(
    (gesture: BoxGesture) => {
      if (dragFrameRef.current !== null) return
      const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
      if (frame === null) {
        runDragFrame(gesture)
        return
      }
      dragFrameRef.current = frame(() => runDragFrame(gesture))
    },
    [runDragFrame],
  )

  /**
   * 取消挂起的拖拽帧：帧闭包捕获的是当次手势对象，手势结束（up/cancel）后迟到
   * 触发会画出幽灵矩形并回写过期预览（快于 16ms 的点拖、后台标签页 rAF 节流）；
   * 同时不取消会让 dragFrameRef 卡在非空，下一手势的首批 move 被边沿触发丢弃。
   */
  const cancelDragFrame = useCallback((): void => {
    const frame = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null
    const id = dragFrameRef.current
    if (id !== null) {
      dragFrameRef.current = null
      frame?.(id)
    }
  }, [])

  // ── 双指视口手势（PRD G12）：捏合缩放 + 双指平移 ─────────────────────
  // iPad 上乐谱为 endless 横排，缩放后常宽于视口，而单指拖拽已让给框选语义
  // （selection.md §4.2），触控平移/缩放只能走双指。拖拽面 touch-action: none
  // 使浏览器不会自己接管双指，管线在此自实现。缩放预览走 CSS transform（OSMD
  // 全量重排太重，不能每帧做），抬手一次性提交真实重排并按捏合中点锚定滚动。

  /** 起板：取活跃指针对的前两指；跨度不足（并拢落下）返回 false，等 move 中再试 */
  const startPinchGesture = useCallback((): boolean => {
    if (rendererRef.current === null) return false
    if (gestureRef.current !== null) return false
    const ids = [...activePointersRef.current.keys()].slice(0, 2)
    const points = ids.map((id) => activePointersRef.current.get(id))
    const a = points[0]
    const b = points[1]
    if (a === undefined || b === undefined) return false
    const span0 = pinchSpan(a, b)
    if (span0 < PINCH_MIN_SPAN_PX) return false
    const mid = pinchMidpoint(a, b)
    const boxRect = sheetBoxRef.current?.getBoundingClientRect()
    const stage = stageRef.current
    gestureRef.current = {
      kind: 'pinch',
      pointerIds: [ids[0]!, ids[1]!],
      span0,
      zoom0: zoomRef.current,
      target: zoomRef.current,
      midX0: mid.x,
      midY0: mid.y,
      midX: mid.x,
      midY: mid.y,
      originX: boxRect?.x ?? 0,
      originY: boxRect?.y ?? 0,
      scrollLeft0: stage?.scrollLeft ?? 0,
      scrollTop0: stage?.scrollTop ?? 0,
    }
    return true
  }, [])

  const clearPinchPreview = useCallback((): void => {
    const sheetBox = sheetBoxRef.current
    if (sheetBox !== null) {
      sheetBox.style.transform = ''
      sheetBox.style.transformOrigin = ''
    }
  }, [])

  const schedulePinchLabel = useCallback((target: number): void => {
    pinchLabelTargetRef.current = target
    if (pinchLabelFrameRef.current !== null) return
    const frame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback: () => void): number => window.setTimeout(callback, 16)
    pinchLabelFrameRef.current = frame(() => {
      pinchLabelFrameRef.current = null
      if (pinchLabelTargetRef.current !== null) setZoom(pinchLabelTargetRef.current)
    })
  }, [])

  const cancelPinchLabel = useCallback((): void => {
    if (pinchLabelFrameRef.current === null) return
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pinchLabelFrameRef.current)
    else window.clearTimeout(pinchLabelFrameRef.current)
    pinchLabelFrameRef.current = null
    pinchLabelTargetRef.current = null
  }, [])

  /** 双指手势结束：commit=false（pointercancel）回退预览不重排；true 提交缩放并锚定滚动 */
  const endPinch = useCallback(
    (gesture: PinchGesture, commit: boolean): void => {
      gestureRef.current = null
      activePointersRef.current.clear() // 剩余手指不单独成手势，抬起不再触发 tap
      cancelPinchLabel() // 在途倍率合帧不覆盖终值
      clearPinchPreview()
      // 双指快速交替的抖动不构成双击节奏（suppress 与框选同款语义）
      suppressDoubleRef.current = Date.now() + SUPPRESS_DOUBLE_MS
      if (!commit) {
        // 视口手势中断：缩放显示回退（§4.2 pointercancel 中止一切）
        zoomRef.current = gesture.zoom0
        setZoom(gesture.zoom0)
        return
      }
      const target = gesture.target
      if (Math.abs(target - gesture.zoom0) <= PINCH_ZOOM_EPSILON) return
      zoomRef.current = target
      setZoom(target)
      const stage = stageRef.current
      if (stage === null) {
        void rerender(target)
        return
      }
      // 锚定提交：捏合中点下的谱面点在重排后留在原视口位置（横向）
      const stageRect = stage.getBoundingClientRect()
      const anchorViewportX = gesture.midX - stageRect.x
      const beforeOffset = stage.scrollLeft
      const beforeTotal = stage.scrollWidth
      void rerender(target).then(() => {
        const stageNow = stageRef.current
        if (stageNow === null || beforeTotal <= 0) return
        stageNow.scrollLeft = clampedScroll(
          anchoredScrollLeft(beforeOffset, anchorViewportX, beforeTotal, stageNow.scrollWidth),
          stageNow.scrollWidth,
          stageNow.clientWidth,
        )
      })
    },
    [cancelPinchLabel, clearPinchPreview, rerender],
  )

  // ── 指针事件管线（S5：原生监听 + setPointerCapture + 4px slop + pointercancel 中止）──

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return

    const onPointerDown = (event: PointerEvent): void => {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      try {
        stage.setPointerCapture(event.pointerId)
      } catch {
        // jsdom/无捕获环境：管线降级为普通监听
      }
      const existing = gestureRef.current
      // 第二指落下 → 双指视口手势接管：单指意图（tap/框选/句柄）一律作废，双指不产生选择
      if (existing !== null && existing.kind !== 'pinch') {
        if (existing.kind === 'box') {
          cancelDragFrame()
          hideDragRect()
          setBoxPreview(null)
        }
        gestureRef.current = null
      }
      if (gestureRef.current === null && activePointersRef.current.size >= 2) {
        if (startPinchGesture()) return
      }
      if (activePointersRef.current.size >= 2) return // 第三指不参与
      if (event.isPrimary === false || event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      const interaction = interactionRef.current
      const handle = target.closest('[data-selection-handle]')
      if (handle !== null) {
        gestureRef.current = {
          kind: 'handle',
          pointerId: event.pointerId,
          side: (handle as HTMLElement).dataset.selectionHandle === 'end' ? 'end' : 'start',
        }
        return
      }
      const note = interaction?.hitFromEvent(event) ?? null
      gestureRef.current = {
        kind: 'candidate',
        pointerId: event.pointerId,
        x0: event.clientX,
        y0: event.clientY,
        note,
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      const gesture = gestureRef.current
      if (gesture === null) {
        // 两指并拢落下再展开：先跟进坐标，跨度达标时补建捏合（起板瞬间的抖动不作数）
        if (activePointersRef.current.has(event.pointerId)) {
          activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }
        if (activePointersRef.current.size >= 2) startPinchGesture()
        return
      }
      if (gesture.kind === 'pinch') {
        if (!gesture.pointerIds.includes(event.pointerId)) return
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const a = activePointersRef.current.get(gesture.pointerIds[0])
        const b = activePointersRef.current.get(gesture.pointerIds[1])
        if (a === undefined || b === undefined) return
        const mid = pinchMidpoint(a, b)
        gesture.midX = mid.x
        gesture.midY = mid.y
        const stage = stageRef.current
        if (stage !== null) {
          // 双指平移：中点位移写滚动（拖拽面 overflow auto，真值由钳制兜底）
          stage.scrollLeft = clampedScroll(
            gesture.scrollLeft0 - (mid.x - gesture.midX0),
            stage.scrollWidth,
            stage.clientWidth,
          )
          stage.scrollTop = clampedScroll(
            gesture.scrollTop0 - (mid.y - gesture.midY0),
            stage.scrollHeight,
            stage.clientHeight,
          )
        }
        // 捏合缩放：CSS scale 预览（origin 钉在捏合起点），真实重排抬手提交
        gesture.target = targetPinchZoom(
          gesture.zoom0,
          gesture.span0,
          pinchSpan(a, b),
          ZOOM_MIN,
          ZOOM_MAX,
        )
        const sheetBox = sheetBoxRef.current
        if (sheetBox !== null) {
          const scale = gesture.zoom0 > 0 ? gesture.target / gesture.zoom0 : 1
          sheetBox.style.transformOrigin = `${gesture.midX0 - gesture.originX}px ${gesture.midY0 - gesture.originY}px`
          sheetBox.style.transform = `scale(${scale})`
        }
        schedulePinchLabel(gesture.target) // 页脚倍率即时反馈（rAF 合帧，不触发 OSMD 重排）
        return
      }
      if (event.pointerId !== gesture.pointerId) return
      if (gesture.kind === 'candidate') {
        if (Math.hypot(event.clientX - gesture.x0, event.clientY - gesture.y0) <= DRAG_SLOP_PX) {
          return
        }
        // 音符上起板拖拽不进入框选（text-selection.md §3.4）；空白起板 = 框选
        if (gesture.note !== null) {
          gestureRef.current = { kind: 'cancelled', pointerId: gesture.pointerId }
          return
        }
        // 容器原点起板帧缓存一次：拖拽中的矩形换算与预览零 getBoundingClientRect
        const boxRect = containerRef.current?.getBoundingClientRect()
        const box: BoxGesture = {
          kind: 'box',
          pointerId: gesture.pointerId,
          x0: gesture.x0,
          y0: gesture.y0,
          x1: event.clientX,
          y1: event.clientY,
          originX: boxRect?.x ?? 0,
          originY: boxRect?.y ?? 0,
          shift: event.shiftKey,
          ctrlOrMeta: event.ctrlKey || event.metaKey,
        }
        gestureRef.current = box
        scheduleDragFrame(box)
        return
      }
      if (gesture.kind === 'box') {
        gesture.x1 = event.clientX
        gesture.y1 = event.clientY
        // 修饰键取最新事件状态：拖拽中按下/松开 Shift/Ctrl 即时反映到预览与提交（§4.2 v1.6）
        gesture.shift = event.shiftKey
        gesture.ctrlOrMeta = event.ctrlKey || event.metaKey
        scheduleDragFrame(gesture)
      }
    }

    const onPointerUp = (event: PointerEvent): void => {
      activePointersRef.current.delete(event.pointerId)
      const gesture = gestureRef.current
      if (gesture === null) return
      if (gesture.kind === 'pinch') {
        // 第三指抬起不结束捏合；两指之一抬起即提交
        if (!gesture.pointerIds.includes(event.pointerId)) return
        endPinch(gesture, true)
        return
      }
      if (event.pointerId !== gesture.pointerId) return
      gestureRef.current = null
      if (gesture.kind === 'candidate') {
        if (gesture.note !== null) handleTapSelect(gesture.note)
        return
      }
      if (gesture.kind === 'box') {
        cancelDragFrame()
        hideDragRect()
        setBoxPreview(null) // 预览移交提交（同一事件批次内合帧，无中间空档）
        commitBox(gestureRect(gesture), gesture.shift, gesture.ctrlOrMeta)
        // 抬手抑制双击（验收：拖拽期间不触发双击选乐句）
        suppressDoubleRef.current = Date.now() + SUPPRESS_DOUBLE_MS
        return
      }
      if (gesture.kind === 'handle') {
        commitHandle(gesture.side, event.clientX, event.clientY)
        suppressDoubleRef.current = Date.now() + SUPPRESS_DOUBLE_MS
      }
    }

    const onPointerCancel = (event: PointerEvent): void => {
      activePointersRef.current.delete(event.pointerId)
      const gesture = gestureRef.current
      if (gesture === null) return
      // 浏览器接管手势（滚动/缩放）：中止，不产生任何选择（§4.2）
      if (gesture.kind === 'pinch') {
        if (!gesture.pointerIds.includes(event.pointerId)) return
        endPinch(gesture, false)
        return
      }
      if (event.pointerId !== gesture.pointerId) return
      gestureRef.current = null
      if (gesture.kind === 'box') cancelDragFrame()
      hideDragRect()
      setBoxPreview(null)
    }

    const onDoubleClick = (event: MouseEvent): void => {
      if (Date.now() < suppressDoubleRef.current) return
      // capture 重定向使 event.target 恒为 stage，dblclick 命中必须按坐标（S6）
      const note = interactionRef.current?.hitFromClientPoint(event.clientX, event.clientY) ?? null
      if (note !== null) handlePhraseTap(note)
    }

    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointercancel', onPointerCancel)
    stage.addEventListener('dblclick', onDoubleClick)
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerup', onPointerUp)
      stage.removeEventListener('pointercancel', onPointerCancel)
      stage.removeEventListener('dblclick', onDoubleClick)
    }
  }, [handleTapSelect, handlePhraseTap, commitBox, commitHandle, hideDragRect, scheduleDragFrame, cancelDragFrame, startPinchGesture, endPinch, schedulePinchLabel])

  // 触控双击路径（iOS/iPadOS Safari 不触发原生 dblclick，WebKit bug 202143；S6 v1.3）
  useDoubleTap(
    stageRef,
    useCallback(
      (event: PointerEvent) => {
        if (Date.now() < suppressDoubleRef.current) return
        const note = interactionRef.current?.hitFromEvent(event) ?? null
        if (note !== null) handlePhraseTap(note)
      },
      [handlePhraseTap],
    ),
  )

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(dragFrameRef.current)
      }
      cancelPinchLabel()
    },
    [cancelPinchLabel],
  )

  return (
    <>
      <div
        ref={stageRef}
        data-osmd-stage=""
        {...stylex.props(styles.stage, rawContent !== undefined && styles.stageLoaded)}
      >
        {rawContent === undefined ? (
          <p {...stylex.props(styles.placeholder)}>{t.notationPlaceholder}</p>
        ) : (
          <div {...stylex.props(styles.sheetBox)} ref={sheetBoxRef}>
            <div ref={containerRef} {...stylex.props(styles.osmdContainer)} />
            {geometry !== null && (
              <ScoreSelectionOverlay
                positions={geometry.positions}
                rows={geometry.rows}
                pendingNoteIndex={pendingNoteIndex}
                selection={selection}
                previewSelection={boxPreview}
                playingNoteIndex={playingNoteIndex}
                dragLayerRef={dragLayerRef}
              />
            )}
          </div>
        )}
      </div>
      <div {...stylex.props(styles.footer)}>
        <span>{t.notationFootInfo}</span>
        <div {...stylex.props(styles.zoomRow)}>
          <button
            type="button"
            {...stylex.props(styles.zoomChip, styles.zoomBtn)}
            aria-label={t.notationZoomOut}
            onClick={() => applyZoom(-1)}
          >
            －
          </button>
          <span {...stylex.props(styles.zoomChip)}>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            {...stylex.props(styles.zoomChip, styles.zoomBtn)}
            aria-label={t.notationZoomIn}
            onClick={() => applyZoom(1)}
          >
            ＋
          </button>
        </div>
      </div>
    </>
  )
}
