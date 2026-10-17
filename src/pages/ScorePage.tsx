import { useCallback, useState } from 'react'
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 内容区：可滚动；乐谱纸面卡撑满剩余高度 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-[22px]">
        <div className="mb-3.5 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 inline-flex items-center gap-[9px] text-[15px] font-bold tracking-[1.5px] text-fg before:block before:h-[15px] before:w-[3px] before:rounded-[2px] before:bg-verm before:content-['']">
            {t.libraryTitle}
          </h2>
          <div className="flex items-center gap-2.5">
            <InstrumentSelect value={instrument} onChange={setInstrument} />
            <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <span aria-hidden>＋</span>
              {t.loadScore}
            </button>
          </div>
        </div>

        {/* 纸面乐谱卡：ScoreInfo 标题 + OSMD 渲染区（占位，flex-1 撑满）+ 缩放页脚 */}
        <div className="flex flex-1 flex-col rounded-card border border-line bg-paper px-7 pb-4 pt-7 text-ink shadow-paper">
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
