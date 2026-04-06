/**
 * Music Notation Player - Main Application
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { OsmdNotation } from './components/OsmdNotation/OsmdNotation';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import { Header } from './components/Header';
import { ScoreInfo } from './components/ScoreInfo';
import { SelectionInfo } from './components/SelectionInfo';
import { StatusBar } from './components/StatusBar';
import { FileLoaderModal } from './components/FileLoaderModal';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useNoteSelection } from './hooks/useNoteSelection';
import type { SelectedNote } from './components/OsmdNotation/OsmdNotation';
import type { ParsedScore } from './types/notation';
import { DURATION_TO_BEATS, createDemoScore } from './types/notation';
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

function saveInstrument(instrument: InstrumentType): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, instrument);
  }
}

function App() {
  const { t, language } = useTranslation();
  const setLanguage = useSetLanguage();
  const demoXml = createDemoScore();
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [showFileLoader, setShowFileLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempo, setTempo] = useState(60);
  const [currentMeasure, setCurrentMeasure] = useState(-1);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
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
      } catch (err) {
        if (mounted) {
          setScore(parseMusicXML(demoXml));
          setMusicXml(demoXml);
        }
      }
    };
    loadLastFile();
    return () => { mounted = false; };
  }, []);

  // Use note selection hook
  const totalMeasures = score?.measures.length || 8;
  const [selectionState, selectionActions] = useNoteSelection(totalMeasures, []);
  const { selectedNotes } = selectionState;

  // Use audio engine
  const [audioState, audioActions] = useAudioEngine();
  const audioActionsRef = useRef(audioActions);
  useEffect(() => {
    audioActionsRef.current = audioActions;
  }, [audioActions]);

  // Initialize audio
  useEffect(() => {
    let mounted = true;
    const initAudio = async () => {
      try {
        await audioActionsRef.current.init();
        if (mounted) {
          await audioActionsRef.current.loadInstrument(selectedInstrument);
          if (mounted) {
            setIsAudioEnabled(true);
          }
        }
      } catch (err) {
        console.error('Failed to initialize audio:', err);
      }
    };
    const timer = setTimeout(initAudio, 0);
    return () => {
      clearTimeout(timer);
      mounted = false;
    };
  }, [selectedInstrument]);

  // Use playback hook
  const [playbackState, playbackActions] = usePlayback();
  const playbackActionsRef = useRef(playbackActions);
  useEffect(() => {
    playbackActionsRef.current = playbackActions;
  }, [playbackActions]);

  // Playback refs
  const playbackTimeoutRef = useRef<number | null>(null);
  const tonePartRef = useRef<Tone.Part | null>(null);
  const currentNoteStartTimeRef = useRef<number>(0);
  const currentNoteDurationRef = useRef<number>(0);
  const notesToPlayRef = useRef<{ measureIndex: number; noteIndex: number }[]>([]);
  const noteIndexRef = useRef(0);

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

  // Sync loopConfig
  useEffect(() => {
    if (loopConfig.skipBeats > 0 && selectedNotes.length > 0 && score) {
      const sortedNotes = [...selectedNotes].sort((a, b) => {
        if (a.measureIndex !== b.measureIndex) {
          return a.measureIndex - b.measureIndex;
        }
        return a.noteIndex - b.noteIndex;
      });

      let currentBeat = 0;
      let startBeat = 0;
      let endBeat = 0;

      for (let m = 0; m < sortedNotes[0].measureIndex; m++) {
        for (const note of score.measures[m].notes) {
          currentBeat += DURATION_TO_BEATS[note.duration] || 1;
        }
      }
      for (let n = 0; n < sortedNotes[0].noteIndex; n++) {
        currentBeat += DURATION_TO_BEATS[score.measures[sortedNotes[0].measureIndex].notes[n].duration] || 1;
      }
      startBeat = currentBeat;

      currentBeat = 0;
      for (let m = 0; m < sortedNotes[sortedNotes.length - 1].measureIndex; m++) {
        for (const note of score.measures[m].notes) {
          currentBeat += DURATION_TO_BEATS[note.duration] || 1;
        }
      }
      const lastNote = score.measures[sortedNotes[sortedNotes.length - 1].measureIndex]
        .notes[sortedNotes[sortedNotes.length - 1].noteIndex];
      const lastNoteBeats = DURATION_TO_BEATS[lastNote.duration] || 1;
      endBeat = currentBeat + lastNoteBeats;

      playbackActionsRef.current.setLoopRange({
        startBeat,
        endBeat,
        skipBeats: loopConfig.skipBeats
      });
    } else {
      playbackActionsRef.current.setLoopRange(null);
    }
  }, [loopConfig, selectedNotes, score]);

  // Get instrument display
  const getInstrumentDisplay = useCallback(() => {
    const inst = INSTRUMENTS.find(i => i.type === audioState.currentInstrument);
    if (!inst) return { name: 'Piano', icon: '🎹' };
    return {
      name: getInstrumentName(inst.type, t),
      icon: inst.icon,
    };
  }, [audioState.currentInstrument, t]);

  // Select instrument
  const handleSelectInstrument = useCallback(async (instrument: InstrumentType) => {
    setSelectedInstrument(instrument);
    saveInstrument(instrument);
    try {
      await audioActionsRef.current.init();
      await audioActionsRef.current.loadInstrument(instrument);
      setIsAudioEnabled(true);
    } catch (err) {
      setError('Failed to initialize audio. Please try again.');
      console.error('Failed to load instrument:', err);
    }
  }, []);

  // Play selected notes or entire score
  const handlePlay = useCallback(async () => {
    // Ensure audio context is ready
    if (!audioState.isReady) {
      await audioActionsRef.current.init();
    }

    // Stop current playback
    if (tonePartRef.current) {
      tonePartRef.current.stop();
      tonePartRef.current.dispose();
      tonePartRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearInterval(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    playbackActionsRef.current.stop();
    setCurrentMeasure(-1);
    setCurrentNoteIndex(-1);
    noteIndexRef.current = 0;

    playbackActions.play();
    setIsPlaying(true);

    // Build playback notes
    let notesToPlay: { measureIndex: number; noteIndex: number; pitch: string; duration: string }[] = [];

    if (selectedNotes.length > 0) {
      // Play selected notes only
      const sortedNotes = [...selectedNotes].sort((a, b) => {
        if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
        return a.noteIndex - b.noteIndex;
      });

      for (const sel of sortedNotes) {
        const measure = score?.measures[sel.measureIndex];
        if (measure && sel.noteIndex < measure.notes.length) {
          const note = measure.notes[sel.noteIndex];
          if (!note.isRest) {
            notesToPlay.push({
              measureIndex: sel.measureIndex,
              noteIndex: sel.noteIndex,
              pitch: note.pitch,
              duration: note.duration,
            });
          }
        }
      }
    } else if (score?.measures) {
      // Play entire score when no notes selected
      for (let m = 0; m < score.measures.length; m++) {
        const measure = score.measures[m];
        for (let n = 0; n < measure.notes.length; n++) {
          const note = measure.notes[n];
          if (!note.isRest) {
            notesToPlay.push({
              measureIndex: m,
              noteIndex: n,
              pitch: note.pitch,
              duration: note.duration,
            });
          }
        }
      }
    }

    notesToPlayRef.current = notesToPlay;
    noteIndexRef.current = 0;

    // Create Tone.Part
    if (notesToPlay.length > 0) {
      const notesWithTime: Array<{ time: number; note: { pitch: string; duration: string } }> = [];
      let currentTime = 0;

      for (const noteData of notesToPlay) {
        const noteDuration = (DURATION_TO_BEATS[noteData.duration] || 1) * (60 / tempo);
        notesWithTime.push({ time: currentTime, note: noteData });
        currentTime += noteDuration;
      }

      const partEvents: Array<[number, { pitch: string; duration: string }]> = notesWithTime.map(n => [n.time, n.note]);

      const part = new Tone.Part((_time, note) => {
        if (isAudioEnabled) {
          audioActionsRef.current.playNote(note.pitch, note.duration);
        }
      }, partEvents);

      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      Tone.Transport.position = 0;
      part.start(0);
      Tone.Transport.start();
      tonePartRef.current = part;
    }

    // Visual indicator
    const indicatorInterval = setInterval(() => {
      if (noteIndexRef.current >= notesToPlay.length) {
        if (playbackState.loopEnabled) {
          noteIndexRef.current = 0;
        } else {
          clearInterval(indicatorInterval);
          if (tonePartRef.current) {
            tonePartRef.current.stop();
            tonePartRef.current.dispose();
            tonePartRef.current = null;
          }
          setIsPlaying(false);
          playbackActionsRef.current.stop();
        }
        return;
      }

      const { measureIndex: mIdx, noteIndex: nIdx } = notesToPlayRef.current[noteIndexRef.current];
      const measure = score?.measures[mIdx];
      if (measure && nIdx < measure.notes.length) {
        const note = measure.notes[nIdx];
        setCurrentMeasure(mIdx);
        setCurrentNoteIndex(nIdx);
        const noteDuration = (DURATION_TO_BEATS[note.duration] || 1) * (60 / tempo) * 1000;
        currentNoteDurationRef.current = noteDuration;
        currentNoteStartTimeRef.current = Date.now();
      }
      noteIndexRef.current++;
    }, 50);

    playbackTimeoutRef.current = indicatorInterval as unknown as number;
  }, [selectedNotes, score, tempo, isAudioEnabled, playbackState.loopEnabled, playbackActions]);

  // Stop playback
  const handleStop = useCallback(() => {
    if (tonePartRef.current) {
      tonePartRef.current.stop();
      tonePartRef.current.dispose();
      tonePartRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearInterval(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    playbackActionsRef.current.stop();
    setCurrentMeasure(-1);
    setCurrentNoteIndex(-1);
    noteIndexRef.current = 0;
    setIsPlaying(false);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isPlaying: playbackState.isPlaying,
    selectedNotes,
    totalMeasures,
    selectionActions,
    onPlay: handlePlay,
    onStop: handleStop,
  });

  // Cleanup
  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        clearInterval(playbackTimeoutRef.current);
      }
      if (tonePartRef.current) {
        tonePartRef.current.stop();
        tonePartRef.current.dispose();
      }
    };
  }, []);

  const instrumentDisplay = getInstrumentDisplay();

  // Handle note selection from OSMD
  const handleNoteSelect = useCallback((notes: SelectedNote[], mode: 'replace' | 'add') => {
    if (mode === 'replace') {
      selectionActions.selectNotes(notes as { measureIndex: number; noteIndex: number }[], 'replace');
    } else {
      selectionActions.selectNotes(notes as { measureIndex: number; noteIndex: number }[], 'add');
    }
  }, [selectionActions]);

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
              isPlaying={isPlaying}
              indicatorMeasure={currentMeasure}
              indicatorNote={currentNoteIndex}
              className="min-h-62.5"
            />
          </div>

          {/* Selection Info */}
          <SelectionInfo
            selectedNotes={selectedNotes}
            onClearSelection={selectionActions.clearSelection}
            t={t}
          />
        </main>
      </div>

      {/* Playback Controls */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <PlaybackControls
          isPlaying={playbackState.isPlaying}
          canPlay={isAudioEnabled}
          onPlay={handlePlay}
          onPause={handleStop}
          onStop={handleStop}
          tempo={tempo}
          onTempoChange={setTempo}
          loopConfig={loopConfig}
          onLoopConfigChange={setLoopConfig}
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
