import { useCallback, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import FileLoaderModal from '../components/FileLoaderModal'
import InstrumentSelect from '../components/InstrumentSelect'
import OsmdNotation from '../components/OsmdNotation'
import PlaybackControls from '../components/PlaybackControls/PlaybackControls'
import ScoreInfo from '../components/ScoreInfo'
import SelectionInfo from '../components/SelectionInfo'
import StatusBar from '../components/StatusBar'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../locales/useI18n'
import type { InstrumentType, MetronomeSoundType } from '../types/audio'

const styles = stylex.create({
  page: {
    display: 'flex',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
  },
  scrollArea: {
    display: 'flex',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    overflowY: 'auto',
    paddingInline: '16px',
    paddingBottom: '16px',
    '@media (min-width: 640px)': {
      paddingInline: '22px',
    },
  },
  toolRow: {
    marginBottom: '14px',
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  libraryTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '9px',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: 'var(--color-fg)',
    '::before': {
      display: 'block',
      height: '15px',
      width: '3px',
      borderRadius: '2px',
      backgroundColor: 'var(--color-verm)',
      content: '""',
    },
  },
  toolActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  loadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 'var(--radius-btn)',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-cream)',
    backgroundColor: 'var(--color-ink)',
    boxShadow: 'var(--shadow-btn-ink)',
    ':hover': {
      backgroundColor: 'var(--color-ink-hover)',
    },
  },
  scoreCard: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line)',
    backgroundColor: 'var(--color-paper)',
    paddingInline: '28px',
    paddingBottom: '16px',
    paddingTop: '28px',
    color: 'var(--color-ink)',
    boxShadow: 'var(--shadow-paper)',
  },
})

interface ScorePageProps {
  /** 两页共享的播放速度（App 持有，docs/tech.md §2.3） */
  tempo: number
  onTempoChange: (tempo: number) => void
}

/** 乐谱练习页（/）。乐谱渲染、选择模型与播放引擎尚未接入，当前为 UI 层。 */
export default function ScorePage({ tempo, onTempoChange }: ScorePageProps) {
  const { t } = useI18n()
  const [instrument, setInstrument] = useLocalStorage<InstrumentType>('note-slice-preferred-instrument', 'piano')
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [metroSound, setMetroSound] = useLocalStorage<MetronomeSoundType>('note-slice-metronome-sound', 'classic')
  const [strongVolume, setStrongVolume] = useLocalStorage<number>('note-slice-metronome-strong-volume', 0.8)
  const [weakVolume, setWeakVolume] = useLocalStorage<number>('note-slice-metronome-weak-volume', 0.5)
  const [skipBeats, setSkipBeats] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const handlePlayToggle = useCallback(() => setPlaying((value) => !value), [])
  const handleStop = useCallback(() => setPlaying(false), [])
  const handleCloseModal = useCallback(() => setModalOpen(false), [])

  useKeyboardShortcuts({
    onPlayToggle: handlePlayToggle,
    onStop: handleStop,
    enabled: !modalOpen,
  })

  return (
    <div {...stylex.props(styles.page)}>
      {/* 内容区：可滚动；乐谱纸面卡撑满剩余高度 */}
      <div {...stylex.props(styles.scrollArea)}>
        <div {...stylex.props(styles.toolRow)}>
          <h2 {...stylex.props(styles.libraryTitle)}>{t.libraryTitle}</h2>
          <div {...stylex.props(styles.toolActions)}>
            <InstrumentSelect value={instrument} onChange={setInstrument} />
            <button type="button" {...stylex.props(styles.loadBtn)} onClick={() => setModalOpen(true)}>
              <span aria-hidden>＋</span>
              {t.loadScore}
            </button>
          </div>
        </div>

        {/* 纸面乐谱卡：ScoreInfo 标题 + OSMD 渲染区（占位，flex-1 撑满）+ 缩放页脚 */}
        <div {...stylex.props(styles.scoreCard)}>
          <ScoreInfo
            title={t.demoScoreTitle}
            composer={t.demoScoreComposer}
            keySignature={t.keyCMajor}
            timeSignature="4/4"
            tempo={60}
          />
          <OsmdNotation />
        </div>

        <SelectionInfo />
      </div>

      <PlaybackControls
        tempo={tempo}
        onTempoChange={onTempoChange}
        playing={playing}
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        metronomeOn={metronomeOn}
        onMetronomeToggle={() => setMetronomeOn((value) => !value)}
        metroSound={metroSound}
        onMetroSoundChange={setMetroSound}
        strongVolume={strongVolume}
        onStrongVolumeChange={setStrongVolume}
        weakVolume={weakVolume}
        onWeakVolumeChange={setWeakVolume}
        skipBeats={skipBeats}
        onSkipBeatsChange={setSkipBeats}
      />

      <StatusBar playing={playing} skipBeats={skipBeats} instrument={instrument} tempo={tempo} />

      <FileLoaderModal open={modalOpen} onClose={handleCloseModal} />
    </div>
  )
}
