import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ThemeIcon } from '../components/icons/ThemeIcon'
import LoopSkipSelector from '../components/PlaybackControls/LoopSkipSelector'
import TempoSlider from '../components/PlaybackControls/TempoSlider'
import TransportButtons from '../components/PlaybackControls/TransportButtons'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../locales/useI18n'

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
  stubHint: {
    marginTop: '8px',
    display: 'block',
    fontSize: '11px',
    color: 'var(--color-fg-3)',
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
    height: '150px',
    cursor: 'crosshair',
    touchAction: 'none',
    userSelect: 'none',
    overflow: 'hidden',
    borderRadius: '10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line)',
    backgroundColor: 'var(--color-wave-bg)',
  },
  barsRow: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    paddingInline: '10px',
  },
  bar: {
    minWidth: '2px',
    flex: 1,
    borderRadius: '2px',
    backgroundImage: 'linear-gradient(to bottom, var(--color-wave-bar-a), var(--color-wave-bar-b))',
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'color-mix(in srgb, var(--color-wave-bg) 72%, transparent)',
  },
  sliceBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  sliceInner: {
    position: 'absolute',
    inset: 0,
    borderLeftWidth: '2.5px',
    borderRightWidth: '2.5px',
    borderLeftColor: 'var(--color-verm)',
    borderRightColor: 'var(--color-verm)',
    backgroundColor: 'color-mix(in srgb, var(--color-verm) 10%, transparent)',
    boxShadow: 'inset 0 0 20px color-mix(in srgb, var(--color-verm) 14%, transparent)',
  },
  sliceTag: {
    position: 'absolute',
    left: '50%',
    top: '8px',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    borderRadius: 9999,
    backgroundColor: 'var(--color-verm)',
    paddingInline: '10px',
    paddingBlock: '3px',
    fontSize: '11px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-cream)',
    boxShadow: '0 2px 8px -2px color-mix(in srgb, var(--color-verm) 50%, transparent)',
  },
  handle: {
    position: 'absolute',
    top: '50%',
    display: 'grid',
    height: '30px',
    width: '14px',
    transform: 'translateY(-50%)',
    cursor: 'ew-resize',
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: '6px',
    backgroundColor: 'var(--color-verm)',
    boxShadow: '0 2px 8px color-mix(in srgb, var(--color-verm) 45%, transparent)',
  },
  handleLeft: {
    left: '-8px',
  },
  handleRight: {
    right: '-8px',
  },
  handleGrip: {
    height: '12px',
    width: '2px',
    borderRadius: '2px',
    backgroundColor: 'color-mix(in srgb, var(--color-cream) 90%, transparent)',
    boxShadow: '-4px 0 0 var(--color-cream), 4px 0 0 var(--color-cream)',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '38%',
    width: '2px',
    backgroundColor: 'var(--color-gold-bright)',
    boxShadow: '0 0 8px color-mix(in srgb, var(--color-gold-bright) 70%, transparent)',
  },
  playheadArrow: {
    position: 'absolute',
    left: '-5px',
    top: 0,
    height: 0,
    width: 0,
    borderLeftWidth: '5px',
    borderRightWidth: '5px',
    borderTopWidth: '7px',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'var(--color-gold-bright)',
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
      <div {...stylex.props(styles.page)}>
        <div {...stylex.props(styles.card)}>
          <button
            type="button"
            onClick={loadDemoAudio}
            {...stylex.props(styles.emptyBtn)}
          >
            <ThemeIcon name="phones" style={styles.icon32} />
            <span {...stylex.props(styles.dropMain)}>
              {t.audioDropMain} <em {...stylex.props(styles.browseEm)}>{t.dropBrowse}</em>
            </span>
            <span {...stylex.props(styles.dropHint)}>{t.audioDropHint}</span>
            <span {...stylex.props(styles.stubHint)}>{t.audioStubHint}</span>
          </button>
        </div>
      </div>
    )
  }

  const gapSeconds = ((60 / tempo) * gapBeats).toFixed(1)

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.card, styles.cardCompact)}>
        <div {...stylex.props(styles.inner)}>
          <div {...stylex.props(styles.headRow)}>
            <div {...stylex.props(styles.metaRow)}>
              <span
                aria-hidden
                {...stylex.props(styles.iconBox)}
              >
                <ThemeIcon name="phones" style={styles.icon18} />
              </span>
              <span {...stylex.props(styles.metaText)}>
                <div {...stylex.props(styles.audioName)}>{t.demoAudioName}</div>
                <div {...stylex.props(styles.audioMeta)}>
                  {DEMO_AUDIO.sizeLabel} · {formatTime(DEMO_AUDIO.durationSec)} · {DEMO_AUDIO.sampleRateLabel}
                </div>
              </span>
            </div>
            <button
              type="button"
              onClick={removeAudio}
              {...stylex.props(styles.removeBtn)}
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
            {...stylex.props(styles.stage)}
          >
            <div aria-hidden {...stylex.props(styles.barsRow)}>
              {waveBars.map((height, index) => (
                <div
                  key={index}
                  {...stylex.props(styles.bar)}
                  style={{ height: `${Math.min(height, 130)}px` }}
                />
              ))}
            </div>
            {slice !== null && (
              <>
                <div
                  aria-hidden
                  {...stylex.props(styles.mask)}
                  style={{ left: 0, width: `${slice.start * 100}%` }}
                />
                <div
                  aria-hidden
                  {...stylex.props(styles.mask)}
                  style={{ right: 0, left: `${slice.end * 100}%` }}
                />
                <div
                  data-slice-box=""
                  {...stylex.props(styles.sliceBox)}
                  style={{ left: `${slice.start * 100}%`, width: `${(slice.end - slice.start) * 100}%` }}
                  onDoubleClick={() => setSlice(null)}
                >
                  <div aria-hidden {...stylex.props(styles.sliceInner)} />
                  <span {...stylex.props(styles.sliceTag)}>
                    {t.sliceTag(
                      formatTime(slice.start * DEMO_AUDIO.durationSec),
                      formatTime(slice.end * DEMO_AUDIO.durationSec),
                    )}
                  </span>
                  {(['l', 'r'] as const).map((edge) => (
                    <span
                      key={edge}
                      onPointerDown={(event) => handleEdgePointerDown(event, edge)}
                      {...stylex.props(styles.handle, edge === 'l' ? styles.handleLeft : styles.handleRight)}
                    >
                      <span aria-hidden {...stylex.props(styles.handleGrip)} />
                    </span>
                  ))}
                </div>
              </>
            )}
            {playing && (
              <div aria-hidden {...stylex.props(styles.playhead)}>
                <span {...stylex.props(styles.playheadArrow)} />
              </div>
            )}
          </div>

          {slice !== null && (
            <div {...stylex.props(styles.sliceInfoRow)}>
              <span {...stylex.props(styles.loopChip)}>
                {t.loopChipLabel(Math.round((slice.end - slice.start) * DEMO_AUDIO.durationSec))}
              </span>
              <span>
                {t.loopRange(
                  formatTime(slice.start * DEMO_AUDIO.durationSec),
                  formatTime(slice.end * DEMO_AUDIO.durationSec),
                )}
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
      </div>
    </div>
  )
}
