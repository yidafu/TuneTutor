/**
 * Music Notation Player - Main Application
 */

import { useState, useCallback, useEffect } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { OsmdNotation } from './components/OsmdNotation';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import { Header } from './components/Header';
import { ScoreInfo } from './components/ScoreInfo';
import { SelectionInfo } from './components/SelectionInfo';
import { StatusBar } from './components/StatusBar';
import { FileLoaderModal } from './components/FileLoaderModal';
import { PlaybackEngine } from './audio/PlaybackEngine';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { SelectedNote, ParsedScore } from './types/notation';
import type { LoopRange } from './types/playback';
import { createDemoScore } from './types/notation';
import { parseMusicXML } from './utils/notation';
import { getAllFiles } from './utils/storage';
import type { StoredFile } from './types/storedFile';
import type { InstrumentType } from './types/audio';
import { INSTRUMENTS, getInstrumentName } from './types/audio';
import { useTranslation, useSetLanguage, type Language } from './locales/I18nContext';

const STORAGE_KEY = 'note-slice-preferred-instrument';

function getSavedInstrument(): InstrumentType {
  if (typeof window === 'undefined') return 'piano';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && INSTRUMENTS.some(i => i.type === saved)) {
    return saved as InstrumentType;
  }
  return 'piano';
}

const demoXml = createDemoScore();

function App() {
  const { t, language } = useTranslation();
  const setLanguage = useSetLanguage();
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [showFileLoader, setShowFileLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempo, setTempo] = useState(60);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>(getSavedInstrument);
  const [loopConfig, setLoopConfig] = useState({ skipBeats: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // Load last opened file on mount
  useEffect(() => {
    let mounted = true;
    const loadLastFile = async () => {
      try {
        const files = await getAllFiles();
        if (mounted && files.length > 0) {
          const lastFile = files[0]; // Already sorted by newest first
          const loadedScore = parseMusicXML(lastFile.rawContent);
          setScore(loadedScore);
          setMusicXml(lastFile.rawContent);
          setTempo(loadedScore.tempo || 60);
        } else if (mounted) {
          // No files found, use demo score
          setScore(parseMusicXML(demoXml));
          setMusicXml(demoXml);
        }
      } catch {
        // Use demo score on error
        if (mounted) {
          setScore(parseMusicXML(demoXml));
          setMusicXml(demoXml);
        }
      }
    };
    loadLastFile();
    return () => { mounted = false; };
  }, []);

  // Selection state
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);
  const clearSelection = useCallback(() => {
    setSelectedNotes([]);
  }, []);

  // Use playback hook (merged with audio preferences)
  const [playbackState, playbackActions, currentInstrument] = usePlayback();

  // PlaybackEngine for actual audio
  const [playbackEngine] = useState(() => new PlaybackEngine());

  // Derive LoopRange from selected notes and score
  const computeLoopRange = useCallback((notes: SelectedNote[], skpBeats: number): LoopRange | null => {
    if (!score) return null;
    const [beatsPerMeasure] = score.timeSignature.split('/').map(Number);
    const bpm = beatsPerMeasure || 4;

    if (notes.length === 0) {
      const totalBeats = score.measures.length * bpm;
      return { startBeat: 0, endBeat: totalBeats, skipBeats: skpBeats };
    }

    const measureIndices = notes.map(n => n.measureIndex);
    const firstMeasure = Math.min(...measureIndices);
    const lastMeasure = Math.max(...measureIndices);

    return {
      startBeat: firstMeasure * bpm,
      endBeat: (lastMeasure + 1) * bpm,
      skipBeats: skpBeats,
    };
  }, [score]);

  // Sync loopRange to usePlayback when skipBeats or selection changes.
  // loopConfig.skipBeats > 0 enables loop; 0 disables it.
  useEffect(() => {
    const enabled = loopConfig.skipBeats > 0;
    console.log('[App] loop sync effect:', { enabled, hasScore: !!score, selectedCount: selectedNotes.length, skipBeats: loopConfig.skipBeats });
    if (!enabled || !score) {
      playbackActions.setLoopRange(null);
      return;
    }
    const range = computeLoopRange(selectedNotes, loopConfig.skipBeats);
    console.log('[App] computed loop range:', range);
    if (range) playbackActions.setLoopRange(range);
  }, [loopConfig.skipBeats, selectedNotes, score, computeLoopRange, playbackActions]);

  // Handle OSMD ready - load score into PlaybackEngine
  const handleOsmdReady = useCallback((osmd: OpenSheetMusicDisplay) => {
    playbackEngine.loadScore(osmd);
  }, [playbackEngine]);

  // Update PlaybackEngine tempo when it changes
  useEffect(() => {
    playbackEngine.setBpm(tempo);
  }, [tempo, playbackEngine]);

  // Sync time signature for metronome beat counting
  useEffect(() => {
    if (score) {
      const beats = parseInt(score.timeSignature.split('/')[0], 10) || 4;
      playbackEngine.setBeatsPerMeasure(beats);
    }
  }, [score, playbackEngine]);

  // Sync metronome toggle to engine
  useEffect(() => {
    playbackEngine.toggleMetronome(playbackState.metronomeEnabled);
  }, [playbackState.metronomeEnabled, playbackEngine]);

  // Sync metronome sound to engine
  useEffect(() => {
    playbackEngine.setMetronomeSound(playbackState.metronomeSound);
  }, [playbackState.metronomeSound, playbackEngine]);

  // Sync metronome strong volume to engine
  useEffect(() => {
    playbackEngine.setMetronomeStrongVolume(playbackState.metronomeStrongVolume);
  }, [playbackState.metronomeStrongVolume, playbackEngine]);

  // Sync metronome weak volume to engine
  useEffect(() => {
    playbackEngine.setMetronomeWeakVolume(playbackState.metronomeWeakVolume);
  }, [playbackState.metronomeWeakVolume, playbackEngine]);

  // Handle language change
  const handleLanguageChange = useCallback((newLang: Language) => {
    setLanguage(newLang);
  }, [setLanguage]);

  // Handle file loaded
  const handleScoreLoaded = useCallback((loadedScore: ParsedScore, storedFile?: StoredFile) => {
    setScore(loadedScore);
    // 更新 musicXml 状态以触发乐谱重新渲染
    if (storedFile?.rawContent) {
      setMusicXml(storedFile.rawContent);
    }
    setShowFileLoader(false);
    setError(null);
    setTempo(loadedScore.tempo || 60);
  }, []);

  // Handle file load error
  const handleFileError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);


  // Get instrument display
  const getInstrumentDisplay = useCallback(() => {
    const inst = INSTRUMENTS.find(i => i.type === currentInstrument);
    if (!inst) return { name: 'Piano', icon: '🎹' };
    return {
      name: getInstrumentName(inst.type, t),
      icon: inst.icon,
    };
  }, [currentInstrument, t]);

  // Select instrument
  const handleSelectInstrument = useCallback((instrument: InstrumentType) => {
    setSelectedInstrument(instrument);
    playbackActions.setInstrument(instrument);
  }, [playbackActions]);

  // Play - delegates to PlaybackEngine via usePlayback
  const handlePlay = useCallback(async () => {
    const enabled = loopConfig.skipBeats > 0;
    console.log('[App] handlePlay:', { enabled, hasScore: !!score, selectedCount: selectedNotes.length, skipBeats: loopConfig.skipBeats });
    if (enabled && score) {
      const range = computeLoopRange(selectedNotes, loopConfig.skipBeats);
      console.log('[App] handlePlay loop branch, range:', range);
      if (range) {
        console.log('[App] handlePlay -> calling playbackEngine.play with loopConfig');
        await playbackEngine.play({
          enabled: true,
          startBeat: range.startBeat,
          endBeat: range.endBeat,
          skipBeats: range.skipBeats ?? 0,
        });
        playbackActions.play();
        setIsPlaying(true);
        return;
      }
    }
    console.log('[App] handlePlay -> calling playbackEngine.play (no loop)');
    await playbackEngine.play();
    playbackActions.play();
    setIsPlaying(true);
  }, [playbackActions, playbackEngine, score, selectedNotes, loopConfig.skipBeats, computeLoopRange]);

  // Stop playback
  const handleStop = useCallback(() => {
    playbackEngine.stop();
    playbackActions.stop();
    setIsPlaying(false);
  }, [playbackActions, playbackEngine]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isPlaying: playbackState.isPlaying,
    onPlay: handlePlay,
    onStop: handleStop,
  });

  const instrumentDisplay = getInstrumentDisplay();

  // Handle note selection from OSMD
  const handleNoteSelect = useCallback((notes: SelectedNote[]) => {
    setSelectedNotes(notes);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        selectedInstrument={selectedInstrument}
        onSelectInstrument={handleSelectInstrument}
        onOpenFileLoader={() => setShowFileLoader(true)}
        t={t}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <main className="w-full px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8" role="main" aria-label="Music notation display">
          {/* Score Info */}
          <ScoreInfo
            title={score?.title || 'Twinkle Twinkle Little Star'}
            composer={score?.composer}
            timeSignature={score?.timeSignature || '4/4'}
            tempo={score?.tempo || 60}
            t={t}
          />

          {/* Notation Display */}
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
            <OsmdNotation
              musicXml={musicXml || demoXml}
              onNoteSelect={handleNoteSelect}
              onOsmdReady={handleOsmdReady}
              playbackEngine={playbackEngine}
              isPlaying={isPlaying}
              className="min-h-62.5"
            />
          </div>

          {/* Selection Info */}
          <SelectionInfo
            selectedNotes={selectedNotes}
            onClearSelection={clearSelection}
            t={t}
          />
        </main>
      </div>

      {/* Playback Controls */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <PlaybackControls
          isPlaying={playbackState.isPlaying}
          canPlay={true}
          onPlay={handlePlay}
          onPause={handleStop}
          onStop={handleStop}
          tempo={tempo}
          onTempoChange={setTempo}
          loopConfig={loopConfig}
          onLoopConfigChange={setLoopConfig}
          metronomeEnabled={playbackState.metronomeEnabled}
          metronomeSound={playbackState.metronomeSound}
          metronomeStrongVolume={playbackState.metronomeStrongVolume}
          metronomeWeakVolume={playbackState.metronomeWeakVolume}
          onMetronomeToggle={playbackActions.toggleMetronome}
          onMetronomeSoundChange={playbackActions.setMetronomeSound}
          onMetronomeStrongVolumeChange={playbackActions.setMetronomeStrongVolume}
          onMetronomeWeakVolumeChange={playbackActions.setMetronomeWeakVolume}
          t={t}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        selectedNotes={selectedNotes}
        tempo={tempo}
        instrumentName={instrumentDisplay.name}
        loopConfig={loopConfig}
        t={t}
      />

      {/* File Loader Modal */}
      <FileLoaderModal
        show={showFileLoader}
        error={error}
        onClose={() => {
          setShowFileLoader(false);
          setError(null);
        }}
        onScoreLoaded={handleScoreLoaded}
        onError={handleFileError}
        t={t}
      />
    </div>
  );
}

export default App;
