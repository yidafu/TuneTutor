import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js'
import { beatsToSeconds } from '../audio/TempoConverter'
import AudioLibraryModal from '../components/AudioLibraryModal'
import { ThemeIcon } from '../components/icons/ThemeIcon'
import FileHistoryList, { type FileHistoryItem } from '../components/FileLoader/FileHistoryList'
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
import {
  deleteAudioFile,
  getAudioFile,
  getLatestAudioFile,
  listAudioFiles,
  saveAudioFile,
} from '../utils/storage/indexedDB'
import type { StoredAudioFile, StoredAudioFileMeta } from '../types/storedFile'

/**
 * 原曲练习页（/audio，docs/audio.md §5）：音频导入（MIME/扩展名 + 解码双重校验，点击/拖放/音频库
 * 三条入口，多选逐个入库）、wavesurfer v7 波形（内建 canvas 管线，A9；官方 ZoomPlugin 滚轮/捏合 +
 * －/%/＋ 步进控件，A13）、拖选切片（RegionsPlugin，单切片约束）、切片域视图规则（A14/A15：切片内关
 * 播放头跟随、进度高亮限定切片，切片内已播段朱砂 region 做明暗区分）、region-out 驱动的切片循环 + 空拍（A5）、
 * 多音频库与切片持久化（IndexedDB + localStorage，切片按音频 id 归属，A16）。
 */

const styles = stylex.create({
  page: {
    minHeight: 0,
    flex: 1,
    overflowY: 'auto',
    // 触控专项（PRD G12）：safe-area 让出 iPad 圆角/主屏指示器（浏览器模式 env()=0 不变）
    paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 24px))',
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingTop: '24px',
    '@media (min-width: 640px)': {
      paddingLeft: 'max(22px, env(safe-area-inset-left))',
      paddingRight: 'max(22px, env(safe-area-inset-right))',
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
  headActions: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    gap: '8px',
  },
  recentSection: {
    marginTop: '18px',
  },
  recentHead: {
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--color-fg-3)',
  },
  recentCount: {
    fontWeight: 500,
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

/** 已播段越位容差（秒）：播放头越过切片尾 0.05s（region-out 触发容差）后停在尾部属循环空拍的
 *  正常停留，已播段保持整段；越过超过本容差（seek 到远处、或新拖选的切片与播放头无关）视为
 *  非循环残留，整段深红会被误读为「没播过的区域也高亮」，直接移除（v2.10） */
export const PLAYED_TAIL_TOLERANCE_SEC = 0.5

/** 切片键按音频归属（A16）：`note-slice-audio-slice:<audioId>`；多音频互不串切片，切回即恢复。
 * 旧全局键（v2.3 及前单音频时代）无归属信息，默认属于启动恢复的最新一条——首次读取时迁移。 */
const SLICE_KEY_PREFIX = 'note-slice-audio-slice'
const LEGACY_SLICE_KEY = 'note-slice-audio-slice'

function sliceKey(audioId: string): string {
  return `${SLICE_KEY_PREFIX}:${audioId}`
}

/** canvas 不认 CSS 变量：创建/换肤时读取 token 具体值（T1 皮肤契约：色值只出自 index.css token） */
function themeColor(tokenName: string): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim()
  return value === '' ? undefined : value
}

/** 波形配色。进度高亮域（决策 A15）：内置进度层恒从 0 画到播放头、无法裁剪进切片——
 * 切片域内整层退化为波形色（视觉关闭），高亮只来自切片 region 覆盖层 + 金色播放头；
 * 无切片恢复朱砂双层进度。 */
function waveColors(sliceActive: boolean): Partial<Parameters<typeof WaveSurfer.create>[0]> {
  const waveColor = themeColor('--color-wave-bar-a')
  const progressColor = sliceActive ? waveColor : themeColor('--color-verm')
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

/** 已播段朱砂色 = verm token + 更高不透明度（A15 补强：切片内已播/未播明暗区分）。
 * 叠在切片底衬之上（第二实例容器在后，天然盖住第一实例），有效浓度约为底衬两倍半。 */
function playedColor(): string | undefined {
  const vermilion = themeColor('--color-verm')
  return vermilion === undefined ? undefined : `${vermilion}59`
}

/** 读当前音频的切片；旧全局键存在于启动恢复路径时迁移到该音频名下（仅内容合法才迁移） */
function readPersistedSlice(audioId: string): AudioSlice | null {
  try {
    const ownKey = sliceKey(audioId)
    let raw = window.localStorage.getItem(ownKey)
    const migrated = raw === null
    if (migrated) raw = window.localStorage.getItem(LEGACY_SLICE_KEY)
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
    if (migrated) {
      window.localStorage.removeItem(LEGACY_SLICE_KEY)
      window.localStorage.setItem(ownKey, raw)
    }
    return { startTime, endTime }
  } catch {
    return null
  }
}

function persistSlice(audioId: string | null, slice: AudioSlice | null): void {
  if (audioId === null) return
  const key = sliceKey(audioId)
  if (slice === null) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, JSON.stringify(slice))
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
  // 音频库：IndexedDB 元信息投影（uploadedAt 降序）+ 弹窗开关 + 多文件转存进行中
  const [library, setLibrary] = useState<StoredAudioFileMeta[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [importing, setImporting] = useState(false)
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
  // 已播段高亮（A15 补强）：第二 RegionsPlugin 实例与它的唯一 region；
  // 页面只订阅第一实例（切片约束/循环），第二实例的事件总线天然隔离
  const playedRegionsRef = useRef<RegionsPlugin | null>(null)
  const playedRegionRef = useRef<Region | null>(null)
  // 切片键归属当前音频（A16）：稳定回调里读 ref，避免闭包拿到旧音频 id
  const audioIdRef = useRef<string | null>(null)
  audioIdRef.current = audio?.id ?? null

  // 稳定回调里读取的实时值（避免重建 wavesurfer 事件订阅）
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const gapRef = useRef(gapBeats)
  gapRef.current = gapBeats
  // 缩放值的同步 ref：缩放回调不需要重订阅（zoom 事件随时改写）
  const pxPerSecRef = useRef(0)

  // 已播段同步（A15 补强）：区间恒为 [切片起点, min(播放头, 切片终点)]；播放头未进切片（≤ 起点）
  // 即整条移除。元素 pointerEvents: none——第二实例容器叠在切片 region 之上，放行指针事件
  // 才不挡拖移与把手。timeupdate 在 setTime/点击定位时也会广播，暂停态同样即时更新。
  const syncPlayedRegion = useCallback((playhead: number): void => {
    const playedRegions = playedRegionsRef.current
    if (playedRegions === null) return
    const existing = playedRegionRef.current
    const removePlayed = (): void => {
      if (playedRegionRef.current === null) return
      const region = playedRegionRef.current
      playedRegionRef.current = null
      region.remove()
    }
    const slice = sliceRef.current
    if (
      slice === null ||
      playhead <= slice.startTime ||
      playhead > slice.endTime + PLAYED_TAIL_TOLERANCE_SEC
    ) {
      removePlayed()
      return
    }
    const end = Math.min(playhead, slice.endTime)
    if (existing === null) {
      const region = playedRegions.addRegion({
        start: slice.startTime,
        end,
        color: playedColor(),
        drag: false,
        resize: false,
      })
      if (region.element !== null) region.element.style.pointerEvents = 'none'
      playedRegionRef.current = region
    } else {
      existing.setOptions({ start: slice.startTime, end })
    }
  }, [])

  const updateSlice = useCallback((next: AudioSlice | null, persist = true): void => {
    sliceRef.current = next
    setSlice(next)
    if (persist) persistSlice(audioIdRef.current, next)
    // 切片域视图参数（决策 A14/A15）：切片循环把播放头锁在切片内，放任官方默认 autoScroll 会在
    // 放大后每次回卷猛拉视口、与手动平移拉锯——有切片即关；进度高亮同理退化（高亮只来自 region）
    const sliceActive = next !== null
    wsRef.current?.setOptions({ autoScroll: !sliceActive, ...waveColors(sliceActive) })
    // 已播段随切片界重算：删切片即移除，改界后按当前播放头重新钳位
    syncPlayedRegion(wsRef.current?.getCurrentTime() ?? 0)
  }, [syncPlayedRegion])

  const refreshLibrary = useCallback(() => {
    listAudioFiles()
      .then(setLibrary)
      .catch((error: unknown) => console.warn('[OriginalAudioPage] list audio failed:', error))
  }, [])

  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

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
      ...waveColors(false),
    })
    const subscriptions: (() => void)[] = []
    let unsubscribeDrag: (() => void) | null = null
    const regions = ws.registerPlugin(RegionsPlugin.create())
    // 已播段容器（A15 补强）：第二实例只用来挂一条 pointerEvents:none 的已播 region，
    // 不订阅其事件——与第一实例的切片约束/循环判定互不干扰
    playedRegionsRef.current = ws.registerPlugin(RegionsPlugin.create())
    // 官方 ZoomPlugin：波形上滚轮/双指捏合缩放（指针锚定）；步进控件走同一 ws.zoom()（A13）
    ws.registerPlugin(ZoomPlugin.create({ maxZoom: ZOOM_MAX_PX_PER_SEC }))

    // 双指平移（触屏专属，v2.10）：ZoomPlugin 只消费双指「距离变化」（捏合），同向移动是
    // preventDefault 掉的死区——A14 关闭 autoScroll 后的「原生平移」（触控板横扫/横向滚轮）
    // 在 iPad 上不存在，单指拖动又归拖选，放大后视图无平移手段（用户实测反馈）。监听挂
    // scroll 容器且晚于 ZoomPlugin 注册：每次 touchmove 先让 ZoomPlugin 按距离比缩放并
    // 锚定捏合中心，本监听后跑、在其 scrollLeft 之上叠加双指中心位移 → pan+pinch 复合手势
    const scrollEl = ws.getWrapper().parentElement
    if (scrollEl !== null) {
      let lastPanCenterX: number | null = null
      const handlePanTouchMove = (event: TouchEvent): void => {
        if (event.touches.length !== 2) {
          lastPanCenterX = null
          return
        }
        const center = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2
        if (lastPanCenterX !== null) scrollEl.scrollLeft -= center - lastPanCenterX
        lastPanCenterX = center
      }
      const resetPanCenter = (): void => {
        lastPanCenterX = null
      }
      scrollEl.addEventListener('touchmove', handlePanTouchMove)
      scrollEl.addEventListener('touchend', resetPanCenter)
      scrollEl.addEventListener('touchcancel', resetPanCenter)
      subscriptions.push(() => {
        scrollEl.removeEventListener('touchmove', handlePanTouchMove)
        scrollEl.removeEventListener('touchend', resetPanCenter)
        scrollEl.removeEventListener('touchcancel', resetPanCenter)
      })
    }
    wsRef.current = ws

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
        const stored = readPersistedSlice(audio.id)
        if (
          stored !== null &&
          stored.endTime <= readyDuration &&
          buildAudioLoopPlan(stored.startTime, stored.endTime, 0, readyDuration).loop
        ) {
          // 恢复的切片 UI 状态由 region-created 订阅统一同步，此处只建 region
          regions.addRegion({
            start: stored.startTime,
            end: stored.endTime,
            color: regionColor(),
            drag: true,
            resize: true,
            minLength: MIN_SLICE_SECONDS,
          })
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

    // 已播段跟随播放头（A15 补强）
    subscriptions.push(
      ws.on('timeupdate', (time: number) => {
        syncPlayedRegion(time)
      }),
    )

    // 单切片约束：新 region 出现即移除旧 region；切片状态与持久化在创建时即同步——
    // 拖选新建的 region 只发 region-created，插件的 update-end 仅在拖移/resize 结束时发
    // （7.12.11 源码核实），等 update-end 会让首次拖选的切片悬空、播放键拿不到起点（§5.1）。
    // 先换 sliceRegionRef 再 remove 旧 region（v2.10）：remove 同步触发 region-removed，
    // 若 ref 尚指旧 region 会先走一遭 updateSlice(null)（进度色恢复朱砂 + reRender）再被
    // 新切片的 updateSlice 覆盖——两次异步分片重渲染竞速，朱砂进度层可能残留出「非选区
    // 高亮」；换 ref 在前使 region-removed 回调的 current 比对为假，替换路径零中间态
    subscriptions.push(
      regions.on('region-created', (region: Region) => {
        const previous = sliceRegionRef.current
        sliceRegionRef.current = region
        if (previous !== null && previous !== region) previous.remove()
        updateSlice({ startTime: region.start, endTime: region.end })
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
      playedRegionRef.current = null
      playedRegionsRef.current = null
      wsRef.current = null
      ws.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio])

  // 皮肤切换：setOptions 重着色（不重解码），canvas 不认 CSS 变量故读 token 具体值；随切片域状态出进度色（A15）
  useEffect(() => {
    wsRef.current?.setOptions(waveColors(sliceRef.current !== null))
    // region 配色同样出自 token：切片底衬与已播段随主题重读
    sliceRegionRef.current?.setOptions({ color: regionColor() })
    playedRegionRef.current?.setOptions({ color: playedColor() })
  }, [theme])

  // 后台标签页 rAF 停摆 → region-out 不触发；隐藏即暂停循环（docs/audio.md §5.2，最小正确解）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) wsRef.current?.pause()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  /** 装载一条音频（导入/库切换共口）：重置瞬时 UI 态；切片 UI 清空但不落盘——
   *  旧音频的切片键保留（A16 归属隔离），新实例 ready 后读自己的键 */
  const activateAudio = useCallback(
    (stored: StoredAudioFile) => {
      setDuration(0)
      setSampleRateLabel(null)
      updateSlice(null, false)
      setErrorText(null)
      setAudio(stored)
    },
    [updateSlice],
  )

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (files === null || files.length === 0 || importing) return
      setImporting(true)
      // 多选/多文件投放（A16）：逐个过白名单与转存，全部合法文件入库，活动音频取最后一个——
      // 其 uploadedAt 最新，与库列表（降序）头部一致
      let lastStored: StoredAudioFile | null = null
      let unsupported = false
      let decodeFailed = false
      try {
        for (const file of Array.from(files)) {
          // 第一道闸：MIME/扩展名白名单；第二道闸是 wavesurfer 解码（error 事件，docs/audio.md §5.1）
          if (!isSupportedAudioFile(file)) {
            unsupported = true
            continue
          }
          try {
            const data = await file.arrayBuffer()
            let stored: StoredAudioFile
            try {
              stored = await saveAudioFile({ fileName: file.name, fileSize: file.size, data })
            } catch (storageError: unknown) {
              console.warn('[OriginalAudioPage] save audio failed:', storageError)
              stored = { id: 'session', fileName: file.name, fileSize: file.size, uploadedAt: Date.now(), data }
            }
            lastStored = stored
          } catch (readError: unknown) {
            console.error('[OriginalAudioPage] read audio failed:', readError)
            decodeFailed = true
          }
        }
        if (lastStored !== null) activateAudio(lastStored)
        setErrorText(unsupported ? t.errorUnsupportedAudio : decodeFailed ? t.errorAudioDecode : null)
        refreshLibrary()
      } finally {
        setImporting(false)
      }
    },
    [activateAudio, importing, refreshLibrary, t],
  )

  /** 库列表/弹窗点选：装载该音频并收起弹窗 */
  const handleSelectItem = useCallback(
    (id: string) => {
      getAudioFile(id)
        .then((stored) => {
          if (stored === undefined) return
          activateAudio(stored)
          setLibraryOpen(false)
        })
        .catch((error: unknown) => console.warn('[OriginalAudioPage] load audio failed:', error))
    },
    [activateAudio],
  )

  /** 库内删除：数据行与其切片键一并清除；若删的是当前装载音频，内存副本继续可用 */
  const handleDeleteItem = useCallback(
    (id: string) => {
      persistSlice(id, null)
      deleteAudioFile(id)
        .then(refreshLibrary)
        .catch((error: unknown) => console.warn('[OriginalAudioPage] delete audio failed:', error))
    },
    [refreshLibrary],
  )

  const handleRemoveAudio = useCallback(() => {
    const current = audio
    // 列表在删除落地后刷新（先行刷新会把刚删的行列成仍在库）
    const refreshAfterDelete = () => refreshLibrary()
    if (current !== null && current.id !== 'session') {
      deleteAudioFile(current.id)
        .then(refreshAfterDelete)
        .catch((error: unknown) => {
          console.warn('[OriginalAudioPage] delete audio failed:', error)
          refreshAfterDelete()
        })
    } else {
      refreshAfterDelete()
    }
    if (current !== null) persistSlice(current.id, null)
    updateSlice(null, false)
    setAudio(null)
    setDuration(0)
    setSampleRateLabel(null)
    setErrorText(null)
    setPlaying(false)
  }, [audio, refreshLibrary, updateSlice])

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

  // 弹窗打开时停用全局快捷键（Space/Esc 由弹窗自身接管，FileLoaderModal 同约定）
  useKeyboardShortcuts({ onPlayToggle: handlePlayToggle, onStop: handleStop, enabled: !libraryOpen })

  const inputRef = useRef<HTMLInputElement>(null)
  const openFilePicker = useCallback(() => inputRef.current?.click(), [])
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".mp3,.wav,.ogg,.m4a,audio/*"
      multiple
      onChange={(event) => {
        void handleFilesSelected(event.target.files)
        event.target.value = ''
      }}
      {...stylex.props(styles.hiddenInput)}
      aria-hidden="true"
      tabIndex={-1}
    />
  )

  /** StoredAudioFileMeta → FileHistoryList 条目（title 位放文件名） */
  function toHistoryItem(meta: StoredAudioFileMeta): FileHistoryItem {
    return { id: meta.id, title: meta.fileName, fileSize: meta.fileSize, uploadedAt: meta.uploadedAt }
  }

  const libraryList = (
    <FileHistoryList
      items={library.map(toHistoryItem)}
      icon="phones"
      activeId={audioIdRef.current}
      onSelect={handleSelectItem}
      onDelete={handleDeleteItem}
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
          {/* 加载款（A16）：最近音频直接陈列在空态，点选即装载（与音频库弹窗同源 IndexedDB） */}
          {library.length > 0 && (
            <div {...stylex.props(styles.recentSection)}>
              <h4 {...stylex.props(styles.recentHead)}>
                <span>{t.recentAudio}</span>
                <span {...stylex.props(styles.recentCount)}>{library.length}</span>
              </h4>
              {libraryList}
            </div>
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
    <>
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
              <div {...stylex.props(styles.headActions)}>
                <button
                  type="button"
                  onClick={() => {
                    // 打开即对账一次：入库都经页面导入路径，正常无漂移；防外部/并发写入的陈旧列表
                    refreshLibrary()
                    setLibraryOpen(true)
                  }}
                  {...stylex.props(styles.removeBtn)}
                >
                  <span aria-hidden>＋</span> {t.audioLibraryTitle}
                </button>
                <button type="button" onClick={handleRemoveAudio} {...stylex.props(styles.removeBtn)}>
                  {t.removeAudio}
                </button>
              </div>
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
              <TransportButtons playing={playing} onPlayToggle={handlePlayToggle} />
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
      {/* 音频库弹窗挂在拖放容器外：弹窗内的 drop 不冒泡进页面级导入管线造成双重入库 */}
      <AudioLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        items={library}
        activeId={audioIdRef.current}
        importing={importing}
        errorText={errorText}
        onFilesSelected={(files) => void handleFilesSelected(files)}
        onSelectItem={handleSelectItem}
        onDeleteItem={handleDeleteItem}
      />
    </>
  )
}
