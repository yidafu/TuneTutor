import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import FileLoaderModal from '../components/FileLoaderModal'
import type { FileHistoryItem } from '../components/FileLoader/FileHistoryList'
import InstrumentSelect from '../components/InstrumentSelect'
import OsmdNotation from '../components/OsmdNotation'
import PlaybackControls from '../components/PlaybackControls/PlaybackControls'
import ScoreInfo from '../components/ScoreInfo'
import SelectionInfo from '../components/SelectionInfo'
import StatusBar from '../components/StatusBar'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../locales/useI18n'
import type { TranslationSet } from '../locales/en-US'
import type { InstrumentType, MetronomeSoundType } from '../types/audio'
import type { ParsedScore } from '../types/notation'
import {
  describeSelection,
  type ScoreSelection,
  type SelectionSummary,
} from '../utils/notation/selection'
import { createDemoScore } from '../utils/createDemoScore'
import {
  deleteStoredFile,
  getLatestStoredFile,
  getStoredFile,
  listStoredFiles,
  saveStoredFile,
} from '../utils/storage/indexedDB'
import { ImportFileError, processFile, type ImportErrorCode } from '../utils/notation/processFile'

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

interface LoadedScore {
  rawContent: string
  parsedScore: ParsedScore
}

/** E1–E4 → i18n 键（docs/musicxml.md §6） */
function importErrorText(t: TranslationSet, code: ImportErrorCode): string {
  switch (code) {
    case 'corrupt-archive':
      return t.errorCorruptArchive
    case 'not-musicxml':
      return t.errorNotMusicXML
    case 'parse-failed':
      return t.errorParseFailed
    case 'unsupported-encoding':
      return t.errorUnsupportedEncoding
  }
}

/** 乐谱练习页（/）：OSMD 渲染 + 选择模型（单击小节/双击乐句/框选）+ IndexedDB 历史与启动恢复 */
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

  const [score, setScore] = useState<LoadedScore>(createDemoScore)
  const [history, setHistory] = useState<FileHistoryItem[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // 选择会话态（selection.md S8：不持久化）；摘要供 SelectionInfo/StatusBar 展示。
  // LoopRange 推导（selection.ts computeLoopRange）在播放数据落地（P1）后接入 usePlayback。
  const [selection, setSelection] = useState<ScoreSelection | null>(null)
  const [selectionSummary, setSelectionSummary] = useState<SelectionSummary | null>(null)
  const [selectionInvalid, setSelectionInvalid] = useState(false)
  // 递增信号：通知 OsmdNotation 销毁其内部 pending 意图（selection 保持 null 时也要可达）
  const [clearPendingSignal, setClearPendingSignal] = useState(0)
  const invalidTimerRef = useRef<number | null>(null)

  const handleSelectionChange = useCallback(
    (next: ScoreSelection | null, summary: SelectionSummary | null) => {
      setSelection(next)
      setSelectionSummary(summary)
      setSelectionInvalid(false)
    },
    [],
  )

  const handleSelectionInvalid = useCallback(() => {
    setSelectionInvalid(true)
    if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
    invalidTimerRef.current = window.setTimeout(() => {
      invalidTimerRef.current = null
      setSelectionInvalid(false)
    }, 3000)
  }, [])

  const clearSelection = useCallback(() => {
    setSelection(null)
    setSelectionSummary(null)
    setSelectionInvalid(false)
    setClearPendingSignal((value) => value + 1)
  }, [])

  useEffect(
    () => () => {
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
    },
    [],
  )

  const selectionText = useMemo(
    () => (selectionSummary === null ? undefined : describeSelection(t, selectionSummary)),
    [t, selectionSummary],
  )

  const refreshHistory = useCallback(() => {
    listStoredFiles()
      .then((records) => setHistory(records))
      .catch((error: unknown) => console.warn('[ScorePage] list history failed:', error))
  }, [])

  // 启动恢复：IndexedDB 最新一份，无/失败保持内置示范曲（docs/tech.md §7.3）
  useEffect(() => {
    let cancelled = false
    getLatestStoredFile()
      .then((stored) => {
        if (!cancelled && stored !== undefined) {
          setScore({ rawContent: stored.rawContent, parsedScore: stored.parsedScore })
        }
      })
      .catch((error: unknown) => console.warn('[ScorePage] startup restore failed:', error))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (file === undefined) return
      setImporting(true)
      setImportError(null)
      try {
        const processed = await processFile(file)
        // 入库失败不阻塞本次使用（仅告警）；非法文件在 processFile 已被拒，不入库不留半成品
        try {
          await saveStoredFile({
            fileName: processed.fileName,
            title: processed.parsedScore.title || processed.fileName,
            ...(processed.parsedScore.composer !== undefined
              ? { composer: processed.parsedScore.composer }
              : {}),
            fileSize: processed.fileSize,
            rawContent: processed.rawContent,
            parsedScore: processed.parsedScore,
          })
        } catch (storageError: unknown) {
          console.warn('[ScorePage] save to IndexedDB failed:', storageError)
        }
        setScore({ rawContent: processed.rawContent, parsedScore: processed.parsedScore })
        refreshHistory()
        setModalOpen(false)
      } catch (error: unknown) {
        const code = error instanceof ImportFileError ? error.code : 'parse-failed'
        setImportError(importErrorText(t, code))
      } finally {
        setImporting(false)
      }
    },
    [refreshHistory, t],
  )

  const handleSelectItem = useCallback(
    (id: string) => {
      getStoredFile(id)
        .then((stored) => {
          if (stored === undefined) return
          setScore({ rawContent: stored.rawContent, parsedScore: stored.parsedScore })
          setModalOpen(false)
        })
        .catch((error: unknown) => console.warn('[ScorePage] load file failed:', error))
    },
    [],
  )

  const handleDeleteItem = useCallback(
    (id: string) => {
      deleteStoredFile(id)
        .then(refreshHistory)
        .catch((error: unknown) => console.warn('[ScorePage] delete file failed:', error))
    },
    [refreshHistory],
  )

  const handlePlayToggle = useCallback(() => setPlaying((value) => !value), [])
  const handleStop = useCallback(() => setPlaying(false), [])
  // Esc = 停止并清除（tech.md §6.3）；Stop 按钮只停不走清除
  const handleEscape = useCallback(() => {
    setPlaying(false)
    clearSelection()
  }, [clearSelection])
  const handleCloseModal = useCallback(() => setModalOpen(false), [])

  useKeyboardShortcuts({
    onPlayToggle: handlePlayToggle,
    onStop: handleStop,
    onEscape: handleEscape,
    enabled: !modalOpen,
  })

  const parsed = score.parsedScore

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

        {/* 纸面乐谱卡：ScoreInfo 标题 + OSMD 渲染区 + 缩放页脚 */}
        <div {...stylex.props(styles.scoreCard)}>
          <ScoreInfo
            title={parsed.title || t.untitledScore}
            composer={parsed.composer}
            keySignature={parsed.keySignature}
            timeSignature={parsed.timeSignature}
            tempo={parsed.tempo}
          />
          <OsmdNotation
            rawContent={score.rawContent}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onSelectionInvalid={handleSelectionInvalid}
            clearPendingSignal={clearPendingSignal}
          />
        </div>

        <SelectionInfo selection={selectionSummary} invalid={selectionInvalid} onClear={clearSelection} />
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

      <StatusBar
        playing={playing}
        skipBeats={skipBeats}
        instrument={instrument}
        tempo={tempo}
        selectionText={selectionText}
      />

      <FileLoaderModal
        open={modalOpen}
        onClose={handleCloseModal}
        items={history}
        importing={importing}
        errorText={importError}
        onFilesSelected={(files) => void handleFilesSelected(files)}
        onSelectItem={handleSelectItem}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  )
}
