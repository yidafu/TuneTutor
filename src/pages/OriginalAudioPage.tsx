import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js'
import { beatsToSeconds } from '../audio/TempoConverter'
import { ThemeIcon } from '../components/icons/ThemeIcon'
import LoopSkipSelector from '../components/PlaybackControls/LoopSkipSelector'
import TempoSlider from '../components/PlaybackControls/TempoSlider'
import TransportButtons from '../components/PlaybackControls/TransportButtons'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useTheme } from '../hooks/useTheme'
import { useI18n } from '../locales/useI18n'
import { isSupportedAudioFile } from '../utils/audio/audioFile'
import {
  MIN_SLICE_SECONDS,
  ZOOM_FIT_EPSILON,
  ZOOM_MAX_PX_PER_SEC,
  buildAudioLoopPlan,
  formatFileSize,
  formatTime,
  isTapWithinSlice,
  zoomInPx,
  zoomOutPx,
  zoomPercent,
} from '../utils/audio/sliceUtils'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { deleteAudioFile, getLatestAudioFile, saveAudioFile } from '../utils/storage/indexedDB'
import type { StoredAudioFile } from '../types/storedFile'

/**
 * 原曲练习页（/audio，docs/audio.md §5）：音频导入（MIME/扩展名 + 解码双重校验，支持点击与拖放两条入口）、
 * wavesurfer v7 波形（内建 canvas 管线，A9；官方 ZoomPlugin 滚轮/捏合 + －/%/＋ 步进控件，A13）、
 * 拖选切片（RegionsPlugin，单切片约束）、region-out 驱动的切片循环 + 空拍（A5）、
 * 音频与切片持久化（IndexedDB + localStorage）。
 */

const styles = stylex.create({
  page: {
    minHeight: 0,
    flex: 1,
    overflowY: 'auto',
    paddingInline: '16px',
    paddingBlock: '24px',
    '@media (min-width: 640px)': {
      paddingInline: '22px',
    },
  },
  card: {
    position: 'relative',
    width: '100%',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line)',
    backgroundColor: 'var(--color-surface-2)',
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
  },
  cardCompact: {
    padding: '18px',
  },
  emptyBtn: {
    display: 'block',
    marginInline: 'auto',
    width: '100%',
    maxWidth: '520px',
    borderRadius: 'var(--radius-card)',
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    borderColor: 'var(--color-verm-line-strong)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 4%, transparent)',
    paddingInline: '16px',
    paddingBottom: '30px',
    paddingTop: '36px',
    textAlign: 'center',
    ':hover': {
      backgroundColor: 'var(--color-verm-soft)',
    },
  },
  emptyBtnActive: {
    borderColor: 'var(--color-verm)',
    backgroundColor: 'var(--color-verm-soft)',
  },
  icon32: {
    display: 'block',
    marginInline: 'auto',
    height: '32px',
    width: '32px',
  },
  icon18: {
    height: '18px',
    width: '18px',
  },
  dropMain: {
    marginTop: '8px',
    display: 'block',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  browseEm: {
    fontStyle: 'normal',
    color: 'var(--color-verm-deep)',
  },
  dropHint: {
    marginTop: '3px',
    display: 'block',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--color-fg-3)',
  },
  hiddenInput: {
    display: 'none',
  },
  errorBanner: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    borderRadius: '10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-clay-line)',
    backgroundColor: 'var(--color-clay-soft)',
    paddingInline: '12px',
    paddingBlock: '9px',
    fontSize: '12.5px',
    lineHeight: '18px',
    color: 'var(--color-clay)',
  },
  inner: {
    marginInline: 'auto',
    width: '100%',
    maxWidth: '1120px',
    display: 'flex',
    flexDirection: 'column',
  },
  headRow: {
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  metaRow: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    gap: '11px',
  },
  iconBox: {
    display: 'grid',
    height: '38px',
    width: '38px',
    flex: 'none',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '10px',
    backgroundColor: 'var(--color-wash)',
    boxShadow: 'inset 0 0 0 1px var(--color-line)',
  },
  metaText: {
    minWidth: 0,
  },
  audioName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 600,
  },
  audioMeta: {
    marginTop: '1px',
    fontSize: '12px',
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-fg-3)',
  },
  removeBtn: {
    flex: 'none',
    borderRadius: '9px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    paddingInline: '14px',
    paddingBlock: '7px',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
    color: 'var(--color-fg-2)',
    ':hover': {
      borderColor: 'var(--color-clay-line)',
      backgroundColor: 'var(--color-clay-soft)',
      color: 'var(--color-clay)',
    },
  },
  stage: {
    position: 'relative',
    minHeight: '150px',
    overflow: 'hidden',
    borderRadius: '10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line)',
    backgroundColor: 'var(--color-wave-bg)',
    // 拖拽面禁掉浏览器手势接管（触控拖选/拖动 region 时页面滚动会发 pointercancel 吞掉手势；
    // 双指捏合缩放交给 ZoomPlugin 的合成 wheel）。wavesurfer 产物不含 touch-action。
    touchAction: 'none',
  },
  zoomRow: {
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
  },
  chipBtn: {
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-3)',
    color: 'var(--color-fg-2)',
    paddingInline: '9px',
    paddingBlock: '2px',
    fontSize: '12px',
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums',
    ':hover': {
      backgroundColor: 'var(--color-wash)',
      color: 'var(--color-fg)',
    },
    ':disabled': {
      opacity: 0.4,
      backgroundColor: 'var(--color-surface-3)',
      color: 'var(--color-fg-2)',
    },
  },
  dropOverlay: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-card)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'var(--color-verm)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 6%, transparent)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-verm-deep)',
  },
  sliceInfoRow: {
    marginTop: '12px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '9px',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-fg-2)',
  },
  loopChip: {
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-verm-line)',
    backgroundColor: 'var(--color-verm-soft)',
    paddingInline: '11px',
    paddingBlock: '4px',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    color: 'var(--color-verm-deep)',
  },
  waveHint: {
    marginLeft: 'auto',
    display: 'none',
    fontSize: '11.5px',
    color: 'var(--color-fg-3)',
    '@media (min-width: 1280px)': {
      display: 'inline',
    },
  },
  controlsRow: {
    marginTop: '16px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: '24px',
    rowGap: '12px',
  },
  tempoCell: {
    marginLeft: 'auto',
    width: '300px',
    minWidth: '220px',
  },
})

interface AudioSlice {
  startTime: number
  endTime: number
}

const SLICE_STORAGE_KEY = 'note-slice-audio-slice'

/** canvas 不认 CSS 变量：创建/换肤时读取 token 具体值（T1 皮肤契约：色值只出自 index.css token） */
function themeColor(tokenName: string): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim()
  return value === '' ? undefined : value
}

function waveColors(): Partial<Parameters<typeof WaveSurfer.create>[0]> {
  const waveColor = themeColor('--color-wave-bar-a')
  const progressColor = themeColor('--color-verm')
  const cursorColor = themeColor('--color-gold-bright')
  return {
    ...(waveColor !== undefined ? { waveColor } : {}),
    ...(progressColor !== undefined ? { progressColor } : {}),
    ...(cursorColor !== undefined ? { cursorColor } : {}),
  }
}

/** 切片朱砂色 = verm token + 8 位 hex 透明度（brand 铁律：切片恒朱砂） */
function regionColor(): string | undefined {
  const vermilion = themeColor('--color-verm')
  return vermilion === undefined ? undefined : `${vermilion}2e`
}

function readPersistedSlice(): AudioSlice | null {
  try {
    const raw = window.localStorage.getItem(SLICE_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as AudioSlice).startTime !== 'number' ||
      typeof (parsed as AudioSlice).endTime !== 'number'
    ) {
      return null
    }
    const { startTime, endTime } = parsed as AudioSlice
    if (!(Number.isFinite(startTime) && Number.isFinite(endTime)) || endTime - startTime < MIN_SLICE_SECONDS) {
      return null
    }
    return { startTime, endTime }
  } catch {
    return null
  }
}

function persistSlice(slice: AudioSlice | null): void {
  if (slice === null) window.localStorage.removeItem(SLICE_STORAGE_KEY)
  else window.localStorage.setItem(SLICE_STORAGE_KEY, JSON.stringify(slice))
}

/** 原曲切片循环页。tempo 由 App 共享、本页只读（docs/tech.md §2.3） */
export default function OriginalAudioPage({ tempo }: { tempo: number }) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const [audio, setAudio] = useState<StoredAudioFile | null>(null)
  const [duration, setDuration] = useState(0)
  const [sampleRateLabel, setSampleRateLabel] = useState<string | null>(null)
  const [slice, setSlice] = useState<AudioSlice | null>(null)
  const [playing, setPlaying] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [gapBeats, setGapBeats] = useLocalStorage<number>('note-slice-audio-gap', 0)
  // 拖放导入的悬停高亮（FileLoaderModal 同款 data-drag-active 约定）
  const [dragActive, setDragActive] = useState(false)
  // 当前缩放（px/秒，来自 wavesurfer zoom 事件）；null = 未缩放（适应窗口宽度）
  const [pxPerSec, setPxPerSec] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const sliceRegionRef = useRef<Region | null>(null)
  const sliceRef = useRef<AudioSlice | null>(null)
  const gapWaitingRef = useRef(false)
  const draggingRef = useRef(false)
  const loopTimerRef = useRef<number | null>(null)

  // 稳定回调里读取的实时值（避免重建 wavesurfer 事件订阅）
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const gapRef = useRef(gapBeats)
  gapRef.current = gapBeats
  // 缩放值的同步 ref：缩放回调不需要重订阅（zoom 事件随时改写）
  const pxPerSecRef = useRef(0)

  function updateSlice(next: AudioSlice | null, persist = true): void {
    sliceRef.current = next
    setSlice(next)
    if (persist) persistSlice(next)
    // 播放头跟随（决策 A14）：切片循环把播放头锁在切片内，放任官方默认 autoScroll 会在放大后
    // 每次回卷猛拉视口、与手动平移（触控板横扫/横向滚轮）拉锯——有切片即关，视图由用户掌控
    wsRef.current?.setOptions({ autoScroll: next === null })
  }

  // 启动恢复：IndexedDB 最新一条音频（docs/tech.md §7.3）；切片在 wavesurfer ready 后按已存时长回放
  useEffect(() => {
    let cancelled = false
    getLatestAudioFile()
      .then((stored) => {
        if (!cancelled && stored !== undefined) setAudio(stored)
      })
      .catch((error: unknown) => console.warn('[OriginalAudioPage] restore audio failed:', error))
    return () => {
      cancelled = true
    }
  }, [])

  // wavesurfer 生命周期：一个 audio 一个实例；region 事件驱动切片与循环（docs/audio.md §5.1/§5.2）
  useEffect(() => {
    if (audio === null) return
    const container = containerRef.current
    if (container === null) return

    const ws = WaveSurfer.create({
      container,
      height: 150,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      cursorWidth: 2,
      backend: 'WebAudio',
      dragToSeek: false,
      ...waveColors(),
    })
    const regions = ws.registerPlugin(RegionsPlugin.create())
    // 官方 ZoomPlugin：波形上滚轮/双指捏合缩放（指针锚定）；步进控件走同一 ws.zoom()（A13）
    ws.registerPlugin(ZoomPlugin.create({ maxZoom: ZOOM_MAX_PX_PER_SEC }))
    wsRef.current = ws

    const subscriptions: (() => void)[] = []
    let unsubscribeDrag: (() => void) | null = null

    subscriptions.push(
      ws.on('ready', (readyDuration: number) => {
        setDuration(readyDuration)
        // 新实例从适应窗口宽度起步（未调用过 zoom）
        pxPerSecRef.current = 0
        setPxPerSec(null)
        const decoded = ws.getDecodedData()
        if (decoded !== null) {
          setSampleRateLabel(`${Math.round((decoded.sampleRate / 1000) * 10) / 10} kHz`)
        }
        // addRegion / enableDragSelection 统一在 ready 后调用（docs/audio.md §5.1）
        unsubscribeDrag = regions.enableDragSelection({ color: regionColor() })
        const stored = readPersistedSlice()
        if (
          stored !== null &&
          stored.endTime <= readyDuration &&
          buildAudioLoopPlan(stored.startTime, stored.endTime, 0, readyDuration).loop
        ) {
          regions.addRegion({
            start: stored.startTime,
            end: stored.endTime,
            color: regionColor(),
            drag: true,
            resize: true,
            minLength: MIN_SLICE_SECONDS,
          })
          // 恢复的切片同步回 UI 状态（持久化已在 localStorage，不重写）
          updateSlice({ startTime: stored.startTime, endTime: stored.endTime }, false)
        }
      }),
    )
    // 滚轮/捏合与步进控件共用同一事实来源：核心 zoom() 广播的 minPxPerSec
    subscriptions.push(
      ws.on('zoom', (minPxPerSec: number) => {
        pxPerSecRef.current = minPxPerSec
        setPxPerSec(minPxPerSec)
      }),
    )
    subscriptions.push(ws.on('play', () => setPlaying(true)))
    subscriptions.push(ws.on('pause', () => setPlaying(false)))
    subscriptions.push(ws.on('finish', () => setPlaying(false)))
    subscriptions.push(
      ws.on('error', (error: Error) => {
        console.error('[OriginalAudioPage] wavesurfer error:', error)
        setErrorText(t.errorAudioDecode)
      }),
    )

    // 单切片约束：新 region 出现即移除旧 region；update-end（拖动/resize 结束）才回写持久化
    subscriptions.push(
      regions.on('region-created', (region: Region) => {
        const previous = sliceRegionRef.current
        if (previous !== null && previous !== region) previous.remove()
        sliceRegionRef.current = region
        subscriptions.push(
          region.on('update', () => {
            draggingRef.current = true
          }),
          region.on('update-end', () => {
            draggingRef.current = false
            updateSlice({ startTime: region.start, endTime: region.end })
          }),
        )
      }),
    )
    subscriptions.push(
      regions.on('region-removed', (region: Region) => {
        if (region === sliceRegionRef.current) {
          sliceRegionRef.current = null
          updateSlice(null)
        }
      }),
    )
    // 双击 region = 移除切片与持久化（docs/audio.md §5.1）
    subscriptions.push(
      regions.on('region-double-clicked', (region: Region) => {
        if (region === sliceRegionRef.current) region.remove()
      }),
    )

    // 切片循环：region-out → 暂停 → 空拍 setTimeout → 回卷重播（决策 A5；0 拍 = setTimeout(0) 立即回卷）
    subscriptions.push(
      regions.on('region-out', (region: Region) => {
        if (region !== sliceRegionRef.current) return
        if (gapWaitingRef.current || draggingRef.current) return
        const gapSeconds = Math.max(0, beatsToSeconds(gapRef.current, tempoRef.current))
        const plan = buildAudioLoopPlan(region.start, region.end, gapSeconds, ws.getDuration())
        if (!plan.loop) return
        ws.pause()
        gapWaitingRef.current = true
        loopTimerRef.current = window.setTimeout(() => {
          gapWaitingRef.current = false
          loopTimerRef.current = null
          ws.setTime(plan.offset)
          void ws.play()
        }, Math.round(gapSeconds * 1000))
      }),
    )

    void ws.loadBlob(new Blob([audio.data]))

    return () => {
      if (loopTimerRef.current !== null) window.clearTimeout(loopTimerRef.current)
      loopTimerRef.current = null
      gapWaitingRef.current = false
      draggingRef.current = false
      for (const unsubscribe of subscriptions) unsubscribe()
      unsubscribeDrag?.()
      sliceRegionRef.current = null
      wsRef.current = null
      ws.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio])

  // 皮肤切换：setOptions 重着色（不重解码），canvas 不认 CSS 变量故读 token 具体值
  useEffect(() => {
    wsRef.current?.setOptions(waveColors())
  }, [theme])

  // 后台标签页 rAF 停摆 → region-out 不触发；隐藏即暂停循环（docs/audio.md §5.2，最小正确解）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) wsRef.current?.pause()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (file === undefined) return
      // 第一道闸：MIME/扩展名白名单；第二道闸是 wavesurfer 解码（error 事件，docs/audio.md §5.1）
      if (!isSupportedAudioFile(file)) {
        setErrorText(t.errorUnsupportedAudio)
        return
      }
      setErrorText(null)
      try {
        const data = await file.arrayBuffer()
        let stored: StoredAudioFile
        try {
          stored = await saveAudioFile({ fileName: file.name, fileSize: file.size, data })
        } catch (storageError: unknown) {
          console.warn('[OriginalAudioPage] save audio failed:', storageError)
          stored = { id: 'session', fileName: file.name, fileSize: file.size, uploadedAt: Date.now(), data }
        }
        persistSlice(null)
        updateSlice(null, false)
        setDuration(0)
        setSampleRateLabel(null)
        setAudio(stored)
      } catch (readError: unknown) {
        console.error('[OriginalAudioPage] read audio failed:', readError)
        setErrorText(t.errorAudioDecode)
      }
    },
    [t],
  )

  const handleRemoveAudio = useCallback(() => {
    const current = audio
    if (current !== null && current.id !== 'session') {
      deleteAudioFile(current.id).catch((error: unknown) =>
        console.warn('[OriginalAudioPage] delete audio failed:', error),
      )
    }
    persistSlice(null)
    updateSlice(null, false)
    setAudio(null)
    setDuration(0)
    setSampleRateLabel(null)
    setErrorText(null)
    setPlaying(false)
  }, [audio])

  // 播放键：有切片 → 从切片起点播；无切片 → 全曲顺序（docs/audio.md §5.2）
  const handlePlayToggle = useCallback(() => {
    const ws = wsRef.current
    if (ws === null) return
    if (ws.isPlaying()) {
      ws.pause()
      return
    }
    const current = sliceRef.current
    if (current !== null) {
      ws.setTime(Math.max(0, Math.min(current.startTime, ws.getDuration())))
    }
    void ws.play()
  }, [])

  const handleStop = useCallback(() => {
    wsRef.current?.stop()
  }, [])

  // 双击/双触删切片：触控端 iOS/iPadOS Safari 不触发原生 dblclick（WebKit bug 202143），
  // pointer 双击检测与桌面 region-double-clicked 并存，双方都经 sliceRegionRef 护栏幂等
  const handleWaveDoubleTap = useCallback((event: PointerEvent) => {
    const ws = wsRef.current
    const region = sliceRegionRef.current
    const slice = sliceRef.current
    const container = containerRef.current
    if (ws === null || region === null || slice === null || container === null) return
    const rect = container.getBoundingClientRect()
    if (isTapWithinSlice(event.clientX - rect.left, rect.width, ws.getDuration(), slice)) {
      region.remove() // region-removed 订阅负责清 UI 状态与持久化
    }
  }, [])
  useDoubleTap(containerRef, handleWaveDoubleTap)

  // ---- 波形缩放（A13）：适应宽度 = 容器宽 / 时长；步进控件与滚轮/捏合共享 ws.zoom() ----
  const fitPxPerSec = useCallback((): number => {
    const ws = wsRef.current
    const container = containerRef.current
    if (ws === null || container === null) return 0
    const total = ws.getDuration()
    const width = container.clientWidth
    return width > 0 && total > 0 ? width / total : 0
  }, [])

  const atFitWidth = useCallback((): boolean => {
    const fit = fitPxPerSec()
    return fit <= 0 || Math.max(pxPerSecRef.current, fit) <= fit * ZOOM_FIT_EPSILON
  }, [fitPxPerSec])

  const handleZoomIn = useCallback(() => {
    const ws = wsRef.current
    const fit = fitPxPerSec()
    if (ws === null || fit <= 0) return
    ws.zoom(zoomInPx(pxPerSecRef.current, fit))
  }, [fitPxPerSec])

  const handleZoomOut = useCallback(() => {
    const ws = wsRef.current
    if (ws === null || atFitWidth()) return
    ws.zoom(zoomOutPx(pxPerSecRef.current, fitPxPerSec()))
  }, [atFitWidth, fitPxPerSec])

  const handleZoomFit = useCallback(() => {
    const ws = wsRef.current
    if (ws === null || atFitWidth()) return
    ws.zoom(fitPxPerSec())
  }, [atFitWidth, fitPxPerSec])

  // 拖放导入（FileLoaderModal 同款约定）：dragover 高亮、drop 复用点击入口的校验管线
  const dragHandlers = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragActive(true)
    },
    onDragLeave: () => setDragActive(false),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragActive(false)
      const files = event.dataTransfer.files
      if (files.length > 0) void handleFilesSelected(files)
    },
  }

  useKeyboardShortcuts({ onPlayToggle: handlePlayToggle, onStop: handleStop })

  const inputRef = useRef<HTMLInputElement>(null)
  const openFilePicker = useCallback(() => inputRef.current?.click(), [])
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".mp3,.wav,.ogg,.m4a,audio/*"
      onChange={(event) => {
        void handleFilesSelected(event.target.files)
        event.target.value = ''
      }}
      {...stylex.props(styles.hiddenInput)}
      aria-hidden="true"
      tabIndex={-1}
    />
  )

  if (audio === null) {
    return (
      <div {...stylex.props(styles.page)} {...dragHandlers} data-drag-active={dragActive || undefined}>
        <div {...stylex.props(styles.card)}>
          {fileInput}
          <button
            type="button"
            onClick={openFilePicker}
            {...stylex.props(styles.emptyBtn, dragActive && styles.emptyBtnActive)}
          >
            <ThemeIcon name="phones" style={styles.icon32} />
            <span {...stylex.props(styles.dropMain)}>
              {t.audioDropMain} <em {...stylex.props(styles.browseEm)}>{t.dropBrowse}</em>
            </span>
            <span {...stylex.props(styles.dropHint)}>{t.audioDropHint}</span>
          </button>
          {errorText !== null && (
            <p role="alert" {...stylex.props(styles.errorBanner)}>
              <span aria-hidden>⚠</span>
              {errorText}
            </p>
          )}
        </div>
      </div>
    )
  }

  const gapSeconds = beatsToSeconds(gapBeats, tempo).toFixed(1)
  const fit = fitPxPerSec()
  const zoomLabel = `${zoomPercent(pxPerSec ?? 0, fit)}%`
  const atFit = atFitWidth()
  const atMax = pxPerSec !== null && pxPerSec >= ZOOM_MAX_PX_PER_SEC

  return (
    <div {...stylex.props(styles.page)} {...dragHandlers} data-drag-active={dragActive || undefined}>
      <div {...stylex.props(styles.card, styles.cardCompact)}>
        <div {...stylex.props(styles.inner)}>
          <div {...stylex.props(styles.headRow)}>
            <div {...stylex.props(styles.metaRow)}>
              <span aria-hidden {...stylex.props(styles.iconBox)}>
                <ThemeIcon name="phones" style={styles.icon18} />
              </span>
              <span {...stylex.props(styles.metaText)}>
                <div {...stylex.props(styles.audioName)}>{audio.fileName}</div>
                <div {...stylex.props(styles.audioMeta)}>
                  {formatFileSize(audio.fileSize)}
                  {duration > 0 && ` · ${formatTime(duration)}`}
                  {sampleRateLabel !== null && ` · ${sampleRateLabel}`}
                </div>
              </span>
            </div>
            <button type="button" onClick={handleRemoveAudio} {...stylex.props(styles.removeBtn)}>
              {t.removeAudio}
            </button>
          </div>

          {/* 缩放控件（A13）：－/倍率/＋ 步进；滚轮与捏合由 ZoomPlugin 处理 */}
          <div {...stylex.props(styles.zoomRow)}>
            <button
              type="button"
              aria-label={t.zoomOut}
              title={t.zoomOut}
              disabled={atFit}
              onClick={handleZoomOut}
              {...stylex.props(styles.chipBtn)}
            >
              −
            </button>
            <button
              type="button"
              aria-label={t.zoomFit}
              title={t.zoomFit}
              disabled={atFit}
              onClick={handleZoomFit}
              {...stylex.props(styles.chipBtn)}
            >
              {zoomLabel}
            </button>
            <button
              type="button"
              aria-label={t.zoomIn}
              title={t.zoomIn}
              disabled={atMax}
              onClick={handleZoomIn}
              {...stylex.props(styles.chipBtn)}
            >
              ＋
            </button>
          </div>

          {/* wavesurfer 波形：拖选新建切片 / 拖动移位 / 把手微调 / 双击移除；滚轮缩放（A13） */}
          <div ref={containerRef} data-wave-stage aria-label={t.waveHint} {...stylex.props(styles.stage)} />

          {errorText !== null && (
            <p role="alert" {...stylex.props(styles.errorBanner)}>
              <span aria-hidden>⚠</span>
              {errorText}
            </p>
          )}

          {slice !== null && (
            <div {...stylex.props(styles.sliceInfoRow)}>
              <span {...stylex.props(styles.loopChip)}>
                {t.loopChipLabel(Math.round(slice.endTime - slice.startTime))}
              </span>
              <span>
                {t.loopRange(formatTime(slice.startTime), formatTime(slice.endTime))}
                {gapBeats > 0 && ` · ${t.gapInfo(gapBeats, `${gapSeconds}s`)}`}
              </span>
              <span {...stylex.props(styles.waveHint)}>{t.waveHint}</span>
            </div>
          )}

          <div {...stylex.props(styles.controlsRow)}>
            <TransportButtons playing={playing} onPlayToggle={handlePlayToggle} onStop={handleStop} />
            <LoopSkipSelector value={gapBeats} onChange={setGapBeats} />
            <div {...stylex.props(styles.tempoCell)}>
              {/* 原曲页速度只读，与乐谱页共享（docs/tech.md §2.3） */}
              <TempoSlider value={tempo} onChange={() => {}} disabled />
            </div>
          </div>
        </div>
        {dragActive && (
          <div aria-hidden {...stylex.props(styles.dropOverlay)}>
            {t.audioDropOverlay}
          </div>
        )}
      </div>
      {fileInput}
    </div>
  )
}
