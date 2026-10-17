import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import LoopSkipSelector from '../components/PlaybackControls/LoopSkipSelector'
import TempoSlider from '../components/PlaybackControls/TempoSlider'
import TransportButtons from '../components/PlaybackControls/TransportButtons'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../locales/useI18n'

/** 切片区间（0–1 时长占比）；音频解码接入后换算为秒（docs/tech.md §3 AudioSlice） */
interface SliceRange {
  start: number
  end: number
}

/** 演示音频元数据；wavesurfer 解码接入后由真实文件提供 */
const DEMO_AUDIO = {
  sizeLabel: '8.4 MB',
  durationSec: 204,
  sampleRateLabel: '44.1 kHz',
} as const

const MIN_SLICE_FRACTION = 0.02

/** 确定性伪随机波形条（与 ui-design.html v3 演示一致） */
function buildWaveBars(count: number): number[] {
  let seed = 7
  const next = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: count }, (_, index) => {
    const envelope = 0.35 + 0.65 * Math.abs(Math.sin(index / 9))
    return Math.round((10 + next() * 118) * envelope)
  })
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 原曲练习页（/audio）。音频导入/解码与循环播放尚未接入，波形为静态演示。 */
export default function OriginalAudioPage({ tempo }: { tempo: number }) {
  const { t } = useI18n()
  const [hasAudio, setHasAudio] = useState(false)
  const [slice, setSlice] = useState<SliceRange | null>(null)
  const [gapBeats, setGapBeats] = useLocalStorage<number>('note-slice-audio-gap', 0)
  const [playing, setPlaying] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'create' | 'edge-l' | 'edge-r'; anchor: number } | null>(null)
  const waveBars = useMemo(() => buildWaveBars(96), [])

  const handlePlayToggle = useCallback(() => setPlaying((value) => !value), [])
  const handleStop = useCallback(() => setPlaying(false), [])
  useKeyboardShortcuts({ onPlayToggle: handlePlayToggle, onStop: handleStop })

  const loadDemoAudio = () => {
    setHasAudio(true)
    setSlice({
      start: 42 / DEMO_AUDIO.durationSec,
      end: 65 / DEMO_AUDIO.durationSec,
    })
  }
  const removeAudio = () => {
    setHasAudio(false)
    setSlice(null)
    setPlaying(false)
  }

  function fractionFromPointer(event: ReactPointerEvent): number {
    const rect = stageRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return 0
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }

  function handleStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const fraction = fractionFromPointer(event)
    dragRef.current = { mode: 'create', anchor: fraction }
    stageRef.current?.setPointerCapture(event.pointerId)
    setSlice({ start: fraction, end: fraction })
  }

  function handleEdgePointerDown(event: ReactPointerEvent<HTMLSpanElement>, edge: 'l' | 'r') {
    event.stopPropagation()
    if (slice === null) return
    dragRef.current = { mode: edge === 'l' ? 'edge-l' : 'edge-r', anchor: 0 }
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  function handleStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (drag === null) return
    const fraction = fractionFromPointer(event)
    setSlice((current) => {
      if (drag.mode === 'create') return { start: drag.anchor, end: fraction }
      if (current === null) return current
      return drag.mode === 'edge-l'
        ? { start: fraction, end: current.end }
        : { start: current.start, end: fraction }
    })
  }

  function handleStagePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    setSlice((current) => {
      if (current === null) return current
      let { start, end } = current
      if (start > end) [start, end] = [end, start]
      if (end - start < MIN_SLICE_FRACTION) {
        // 点按（未拖出宽度）不产生切片；微调越界时收缩到最小宽度
        if (drag?.mode === 'create') return null
        start = Math.max(0, Math.min(start, 1 - MIN_SLICE_FRACTION))
        return { start, end: Math.min(1, start + MIN_SLICE_FRACTION) }
      }
      return { start, end }
    })
  }

  if (!hasAudio) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-[22px]">
        <div className="w-full rounded-card border border-line bg-surface-2 p-6 shadow-soft">
        <button
          type="button"
          onClick={loadDemoAudio}
          className="mx-auto block w-full max-w-[520px] cursor-pointer rounded-card border-[1.5px] border-dashed border-verm-line-strong bg-verm/[0.04] px-4 pb-[30px] pt-[36px] text-center transition hover:bg-verm-soft"
        >
          <span aria-hidden className="block text-[30px]">🎧</span>
          <span className="mt-2 block text-[13.5px] font-semibold text-fg">
            {t.audioDropMain} <em className="not-italic text-verm-deep">{t.dropBrowse}</em>
          </span>
          <span className="mt-[3px] block text-xs text-fg-3">{t.audioDropHint}</span>
          <span className="mt-2 block text-[11px] text-fg-3">{t.audioStubHint}</span>
        </button>
        </div>
      </div>
    )
  }

  const gapSeconds = ((60 / tempo) * gapBeats).toFixed(1)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-[22px]">
      <div className="w-full rounded-card border border-line bg-surface-2 p-[18px] shadow-soft">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col">
          <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[11px]">
          <span
            aria-hidden
            className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] bg-[rgb(36_31_21/0.06)] text-[17px] shadow-[inset_0_0_0_1px_var(--color-line)]"
          >
            🎧
          </span>
          <span className="min-w-0">
            <div className="truncate text-sm font-semibold">{t.demoAudioName}</div>
            <div className="mt-px text-xs tabular-nums text-fg-3">
              {DEMO_AUDIO.sizeLabel} · {formatTime(DEMO_AUDIO.durationSec)} · {DEMO_AUDIO.sampleRateLabel}
            </div>
          </span>
        </div>
        <button
          type="button"
          onClick={removeAudio}
          className="flex-none cursor-pointer rounded-[9px] border border-line-strong bg-transparent px-3.5 py-[7px] text-xs font-medium text-fg-2 transition hover:border-clay-line hover:bg-clay-soft hover:text-clay"
        >
          {t.removeAudio}
        </button>
      </div>

      {/* 波形 + 切片（拖拽新建 / 边界微调 / 双击移除） */}
      <div
        ref={stageRef}
        aria-label={t.waveHint}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        className="relative h-[150px] cursor-crosshair touch-none select-none overflow-hidden rounded-[10px] border border-line bg-[#f3efe2]"
      >
        <div aria-hidden className="absolute inset-0 flex items-center gap-[3px] px-2.5">
          {waveBars.map((height, index) => (
            <div
              key={index}
              className="min-w-[2px] flex-1 rounded-[2px] bg-gradient-to-b from-[#b9ae8d] to-[#948a60]"
              style={{ height: `${Math.min(height, 130)}px` }}
            />
          ))}
        </div>
        {slice !== null && (
          <>
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 bg-[rgb(243_239_226/0.72)]"
              style={{ width: `${slice.start * 100}%` }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 bg-[rgb(243_239_226/0.72)]"
              style={{ left: `${slice.end * 100}%` }}
            />
            <div
              className="absolute inset-y-0"
              style={{ left: `${slice.start * 100}%`, width: `${(slice.end - slice.start) * 100}%` }}
              onDoubleClick={() => setSlice(null)}
            >
              <div
                aria-hidden
                className="absolute inset-0 border-l-[2.5px] border-r-[2.5px] border-verm bg-verm/[0.1] shadow-[inset_0_0_20px_rgb(194_67_31/0.14)]"
              />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-verm px-2.5 py-[3px] text-[11px] font-bold tabular-nums text-white shadow-[0_2px_8px_-2px_rgb(165_53_21/0.5)]">
                {t.sliceTag(
                  formatTime(slice.start * DEMO_AUDIO.durationSec),
                  formatTime(slice.end * DEMO_AUDIO.durationSec),
                )}
              </span>
              {(['l', 'r'] as const).map((edge) => (
                <span
                  key={edge}
                  onPointerDown={(event) => handleEdgePointerDown(event, edge)}
                  className={`absolute top-1/2 grid h-[30px] w-[14px] -translate-y-1/2 cursor-ew-resize place-items-center rounded-[6px] bg-verm shadow-[0_2px_8px_rgb(122_39_15/0.45)] ${
                    edge === 'l' ? 'left-[-8px]' : 'right-[-8px]'
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-3 w-0.5 rounded bg-white/90 shadow-[-4px_0_0_rgb(255_255_255/0.9),4px_0_0_rgb(255_255_255/0.9)]"
                  />
                </span>
              ))}
            </div>
          </>
        )}
        {playing && (
          <div
            aria-hidden
            className="absolute inset-y-0 left-[38%] w-0.5 bg-gold-bright shadow-[0_0_8px_rgb(205_132_15/0.7)]"
          >
            <span className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-gold-bright" />
          </div>
        )}
      </div>

      {slice !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-[9px] text-[13px] tabular-nums text-fg-2">
          <span className="rounded-full border border-verm-line bg-verm-soft px-[11px] py-1 text-xs font-semibold text-verm-deep">
            {t.loopChipLabel(Math.round((slice.end - slice.start) * DEMO_AUDIO.durationSec))}
          </span>
          <span>
            {t.loopRange(
              formatTime(slice.start * DEMO_AUDIO.durationSec),
              formatTime(slice.end * DEMO_AUDIO.durationSec),
            )}
            {gapBeats > 0 && ` · ${t.gapInfo(gapBeats, `${gapSeconds}s`)}`}
          </span>
          <span className="ml-auto hidden text-[11.5px] text-fg-3 xl:inline">{t.waveHint}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <TransportButtons playing={playing} onPlayToggle={handlePlayToggle} onStop={handleStop} />
        <LoopSkipSelector value={gapBeats} onChange={setGapBeats} />
        <div className="ml-auto w-[300px] min-w-[220px]">
          {/* 原曲页速度只读，与乐谱页共享（docs/tech.md §2.3） */}
          <TempoSlider value={tempo} onChange={() => {}} disabled />
        </div>
        </div>
      </div>
      </div>
    </div>
  )
}
