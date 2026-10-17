/**
 * ScorePage - The score-practice page (extracted from the original single-page App).
 * Owns score loading/selection/playback; shares `tempo` with the shell.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { OsmdNotation } from '../components/OsmdNotation';
import { PlaybackControls } from '../components/PlaybackControls/PlaybackControls';
import { ScoreInfo } from '../components/ScoreInfo';
import { SelectionInfo } from '../components/SelectionInfo';
import { StatusBar } from '../components/StatusBar';
import { FileLoaderModal } from '../components/FileLoaderModal';
import { PlaybackEngine, PlaybackEvent, type PlaybackStateType } from '../audio/PlaybackEngine';
import { buildTimeline } from '../audio/buildTimeline';
import { usePlayback } from '../hooks/usePlayback';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { SelectedNote, ParsedScore, PhraseSelection } from '../types/notation';
import type { LoopRange, TimelineEntry } from '../types/playback';
import { createDemoScore } from '../utils/createDemoScore';
import { parseMusicXML } from '../utils/notation';
import { getAllFiles } from '../utils/storage';
import type { StoredFile } from '../types/storedFile';
import type { InstrumentType } from '../types/audio';
import { getSavedInstrument, getInstrumentName, INSTRUMENTS } from '../types/audio';
import { beatsToSeconds } from '../audio/TempoConverter';
import { useTranslation } from '../locales/I18nContext';

const demoXml = createDemoScore();

interface ScorePageProps {
  tempo: number;
  onTempoChange: (tempo: number) => void;
}

function ScorePage({ tempo, onTempoChange }: ScorePageProps) {
  const { t } = useTranslation();
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [showFileLoader, setShowFileLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>(getSavedInstrument);
  const [loopConfig, setLoopConfig] = useState({ skipBeats: 0 });
  const [phraseSelection, setPhraseSelection] = useState<PhraseSelection | null>(null);

  // Shared timeline — single source of truth for playback timing
  const [timeline, setTimelineState] = useState<TimelineEntry[]>([]);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

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
          onTempoChange(loadedScore.tempo || 60);
        } else if (mounted) {
          // No files found, use demo score
          const loadedScore = parseMusicXML(demoXml);
          setScore(loadedScore);
          setMusicXml(demoXml);
          onTempoChange(loadedScore.tempo || 60);
        }
      } catch {
        // Use demo score on error
        if (mounted) {
          const loadedScore = parseMusicXML(demoXml);
          setScore(loadedScore);
          setMusicXml(demoXml);
          onTempoChange(loadedScore.tempo || 60);
        }
      }
    };
    loadLastFile();
    return () => { mounted = false; };
  }, [onTempoChange]);

  // Selection state
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);
  const clearSelection = useCallback(() => {
    setSelectedNotes([]);
  }, []);

  // Use playback hook (merged with audio preferences)
  const [playbackState, playbackActions, currentInstrument] = usePlayback();

  // PlaybackEngine for actual audio
  const [playbackEngine] = useState(() => new PlaybackEngine());

  // Stop score playback on unmount (navigating away stops the score)
  useEffect(() => {
    return () => {
      playbackEngine.stop();
    };
  }, [playbackEngine]);

  // Derive phrase loop range from timeline (time in seconds)
  const computePhraseLoopRange = useCallback((phrase: PhraseSelection, tl: TimelineEntry[]): LoopRange | null => {
    const endNote = phrase.endNote;
    if (!endNote) return null;
    const start = tl.find(e =>
      e.measureIndex === phrase.startNote.measureIndex &&
      e.noteIndex === phrase.startNote.noteIndex);
    const end = tl.find(e =>
      e.measureIndex === endNote.measureIndex &&
      e.noteIndex === endNote.noteIndex);
    if (!start || !end) return null;
    return {
      startTime: start.time,
      endTime: end.time + end.duration,
      skipTime: 0,
    };
  }, []);

  // Derive skip-beat loop range from timeline (time in seconds)
  const computeLoopRange = useCallback((notes: SelectedNote[], skipTime: number, tl: TimelineEntry[]): LoopRange | null => {
    if (tl.length === 0) return null;
    if (notes.length === 0) {
      const last = tl[tl.length - 1];
      return { startTime: 0, endTime: last.time + last.duration, skipTime };
    }
    const firstMeasure = notes[0].measureIndex;
    const lastMeasure = notes[notes.length - 1].measureIndex;
    const startEntry = tl.find(e => e.measureIndex === firstMeasure);
    const endEntry = [...tl].reverse().find(e => e.measureIndex === lastMeasure);
    if (!startEntry || !endEntry) return null;
    return {
      startTime: startEntry.time,
      endTime: endEntry.time + endEntry.duration,
      skipTime,
    };
  }, []);

  // Sync loopRange to usePlayback: phrase loop takes priority over skip-beat loop
  useEffect(() => {
    if (timeline.length === 0) {
      playbackActions.setLoopRange(null);
      return;
    }

    if (phraseSelection) {
      const range = computePhraseLoopRange(phraseSelection, timeline);
      if (range) playbackActions.setLoopRange(range);
    } else if (loopConfig.skipBeats > 0) {
      const skipTime = beatsToSeconds(loopConfig.skipBeats, tempo, 4);
      const range = computeLoopRange(selectedNotes, skipTime, timeline);
      if (range) playbackActions.setLoopRange(range);
    } else {
      playbackActions.setLoopRange(null);
    }
  }, [loopConfig.skipBeats, selectedNotes, phraseSelection, timeline, computeLoopRange, computePhraseLoopRange, playbackActions, tempo]);

  // Handle OSMD ready - load score into PlaybackEngine and build timeline
  const handleOsmdReady = useCallback((osmd: OpenSheetMusicDisplay) => {
    osmdRef.current = osmd;
    playbackEngine.loadScore(osmd);
    const tl = buildTimeline(osmd, tempo);
    setTimelineState(tl);
    playbackActions.setTimeline(tl);
  }, [playbackEngine, tempo, playbackActions]);

  // Rebuild timeline when tempo changes
  useEffect(() => {
    playbackEngine.setBpm(tempo);
    if (osmdRef.current) {
      const tl = buildTimeline(osmdRef.current, tempo);
      setTimelineState(tl);
      playbackActions.setTimeline(tl);
    }
  }, [tempo, playbackEngine, playbackActions]);

  // Sync time signature for metronome beat counting
  useEffect(() => {
    if (score) {
      const beats = parseInt(score.timeSignature.split('/')[0], 10) || 4;
      playbackEngine.setBeatsPerMeasure(beats);
    }
  }, [score, playbackEngine]);

  // Sync metronome config to engine (merged into a single effect)
  useEffect(() => {
    playbackEngine.toggleMetronome(playbackState.metronomeEnabled);
    playbackEngine.setMetronomeSound(playbackState.metronomeSound);
    playbackEngine.setMetronomeStrongVolume(playbackState.metronomeStrongVolume);
    playbackEngine.setMetronomeWeakVolume(playbackState.metronomeWeakVolume);
  }, [
    playbackState.metronomeEnabled,
    playbackState.metronomeSound,
    playbackState.metronomeStrongVolume,
    playbackState.metronomeWeakVolume,
    playbackEngine,
  ]);

  // Sync with PlaybackEngine state (handles natural completion)
  useEffect(() => {
    const handleStateChange = (state: PlaybackStateType) => {
      if (state === 'STOPPED') {
        playbackActions.stop();
      }
    };
    playbackEngine.on(PlaybackEvent.STATE_CHANGE, handleStateChange);
  }, [playbackEngine, playbackActions]);

  // Handle file loaded
  const handleScoreLoaded = useCallback((loadedScore: ParsedScore, storedFile?: StoredFile) => {
    setScore(loadedScore);
    if (storedFile?.rawContent) {
      setMusicXml(storedFile.rawContent);
    }
    setShowFileLoader(false);
    setError(null);
    onTempoChange(loadedScore.tempo || 60);
  }, [onTempoChange]);

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

  // Play: phrase loop > skip-beat loop > normal playback
  const handlePlay = useCallback(async () => {
    // Phrase loop (has start+end notes)
    if (phraseSelection && timeline.length > 0) {
      const range = computePhraseLoopRange(phraseSelection, timeline);
      if (range) {
        await playbackEngine.play(range);
        playbackActions.play();
        return;
      }
    }

    // Skip-beat loop
    if (loopConfig.skipBeats > 0 && timeline.length > 0) {
      const skipTime = beatsToSeconds(loopConfig.skipBeats, tempo, 4);
      const range = computeLoopRange(selectedNotes, skipTime, timeline);
      if (range) {
        await playbackEngine.play(range);
        playbackActions.play();
        return;
      }
    }

    // Normal playback
    await playbackEngine.play();
    playbackActions.play();
  }, [playbackActions, playbackEngine, timeline, selectedNotes, phraseSelection, loopConfig.skipBeats, computeLoopRange, computePhraseLoopRange, tempo]);

  // Stop playback
  const handleStop = useCallback(() => {
    playbackEngine.stop();
    playbackActions.stop();
  }, [playbackActions, playbackEngine]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isPlaying: playbackState.isPlaying,
    onPlay: handlePlay,
    onStop: handleStop,
  });

  const instrumentDisplay = getInstrumentDisplay();

  // Handle single-click note selection (clears phrase)
  const handleNoteSelect = useCallback((notes: SelectedNote[]) => {
    setSelectedNotes(notes);
    setPhraseSelection(null);
  }, []);

  // Handle double-click phrase note selection
  const handlePhraseNoteSelected = useCallback((note: SelectedNote) => {
    setSelectedNotes([]);
    setPhraseSelection(prev => {
      if (!prev || prev.endNote !== null) {
        // No phrase or completed phrase → start new selection with start note only
        return { startNote: note, endNote: null };
      }
      // Start already set, now setting end note
      const isAfter =
        note.measureIndex > prev.startNote.measureIndex ||
        (note.measureIndex === prev.startNote.measureIndex && note.noteIndex > prev.startNote.noteIndex);
      if (isAfter) {
        return { startNote: prev.startNote, endNote: note };
      }
      return { startNote: note, endNote: prev.startNote };
    });
  }, []);

  // Clear phrase selection
  const clearPhraseSelection = useCallback(() => {
    setPhraseSelection(null);
  }, []);

  return (
    <main className="w-full px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8" role="main" aria-label="Music notation display">
      {/* Page toolbar: instrument selector + load sheet music */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{t.loadSheetMusic}</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedInstrument}
            onChange={(e) => handleSelectInstrument(e.target.value as InstrumentType)}
            className="px-3 py-2 pr-8 text-white transition-colors bg-purple-600 rounded-lg appearance-none cursor-pointer hover:bg-purple-700"
            aria-label="Select instrument"
          >
            {INSTRUMENTS.map(inst => (
              <option key={inst.type} value={inst.type} className="text-gray-900 bg-white">
                {inst.icon} {getInstrumentName(inst.type, t)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowFileLoader(true)}
            className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            aria-label="Load sheet music file"
          >
            <span aria-hidden="true">📁</span>
            {t.loadFile}
          </button>
        </div>
      </div>

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
          className="min-h-62.5"
          onPhraseNoteSelected={handlePhraseNoteSelected}
          phraseSelection={phraseSelection}
          onClearPhrase={clearPhraseSelection}
        />
      </div>

      {/* Selection Info */}
      <SelectionInfo
        selectedNotes={selectedNotes}
        onClearSelection={clearSelection}
        t={t}
        phraseSelection={phraseSelection}
        onClearPhrase={clearPhraseSelection}
      />

      {/* Playback Controls */}
      <div className="sticky bottom-0 z-10 mt-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        <PlaybackControls
          isPlaying={playbackState.isPlaying}
          canPlay={true}
          onPlay={handlePlay}
          onStopPlaying={handleStop}
          onStop={handleStop}
          tempo={tempo}
          onTempoChange={onTempoChange}
          loopConfig={loopConfig}
          onLoopConfigChange={setLoopConfig}
          metronomeConfig={{
            enabled: playbackState.metronomeEnabled,
            sound: playbackState.metronomeSound,
            strongVolume: playbackState.metronomeStrongVolume,
            weakVolume: playbackState.metronomeWeakVolume,
          }}
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
        phraseSelection={phraseSelection}
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
    </main>
  );
}

export default ScorePage;
