/**
 * Music Notation Player - Main Application
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { NotationDisplay } from './components/NotationDisplay/NotationDisplay';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import { Header } from './components/Header';
import { ScoreInfo } from './components/ScoreInfo';
import { SelectionInfo } from './components/SelectionInfo';
import { StatusBar } from './components/StatusBar';
import { FileLoaderModal } from './components/FileLoaderModal';
import { useNoteSelection } from './hooks/useNoteSelection';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePlayback } from './hooks/usePlayback';
import { noteDurationToSeconds } from './utils/audio/TempoConverter';
import type { ParsedScore } from './types/notation';
import type { StoredFile } from './types/storedFile';
import type { InstrumentType } from './types/audio';
import { INSTRUMENTS } from './types/audio';
import { createDemoScore } from './utils/notation/vexflowHelpers';

function App() {
  const [score, setScore] = useState<ParsedScore>(createDemoScore());
  const [showFileLoader, setShowFileLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempo, setTempo] = useState(120);
  const [currentMeasure, setCurrentMeasure] = useState(-1);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [measureInterval, setMeasureInterval] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Use the unified note selection hook
  const totalMeasures = score?.measures.length || 8;
  const [selectionState, selectionActions] = useNoteSelection(totalMeasures, []);
  const { selectedMeasures, selectedNotes } = selectionState;

  // Use the audio engine
  const [audioState, audioActions] = useAudioEngine();

  // Use the playback hook
  const [playbackState, playbackActions] = usePlayback();

  // Refs for playback
  const playbackTimeoutRef = useRef<number | null>(null);
  const noteIndexRef = useRef(0);
  const startTimeRef = useRef(0);

  // Handle file loaded
  const handleScoreLoaded = useCallback((loadedScore: ParsedScore, _storedFile?: StoredFile) => {
    setScore(loadedScore);
    setShowFileLoader(false);
    setError(null);
    setTempo(loadedScore.tempo || 120);
  }, []);

  // Handle file load error
  const handleFileError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  // Enable audio - load saved instrument
  const handleEnableAudio = useCallback(async () => {
    try {
      setIsLoadingAudio(true);
      await audioActions.init();
      // Load the saved instrument (or default from localStorage)
      await audioActions.loadInstrument(audioState.currentInstrument);
      setIsAudioEnabled(true);
    } catch (err) {
      setError('Failed to initialize audio. Please try again.');
      console.error('Failed to enable audio:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [audioActions, audioState.currentInstrument]);

  // Get instrument display name and icon
  const getInstrumentDisplay = useCallback(() => {
    const inst = INSTRUMENTS.find(i => i.type === audioState.currentInstrument);
    return inst || { name: 'Piano', icon: '🎹' };
  }, [audioState.currentInstrument]);

  // Switch instrument
  const handleSwitchInstrument = useCallback(() => {
    audioActions.loadInstrument(audioState.currentInstrument === 'piano' ? 'saxophone' : 'piano');
  }, [audioActions, audioState.currentInstrument]);

  // Play the selected measures or notes
  const handlePlay = useCallback(() => {
    // Support both measure selection and note selection
    if (selectedMeasures.length === 0 && selectedNotes.length === 0) return;

    // Stop any current playback
    handleStop();

    // Start playback
    playbackActions.play();

    // Determine playback mode and notes to play
    let notesToPlay: { measureIndex: number; noteIndex: number }[] = [];

    if (selectedNotes.length > 0) {
      // Use selected notes directly
      notesToPlay = [...selectedNotes].sort((a, b) => {
        if (a.measureIndex !== b.measureIndex) {
          return a.measureIndex - b.measureIndex;
        }
        return a.noteIndex - b.noteIndex;
      });
    } else if (selectedMeasures.length > 0) {
      // Use all notes from selected measures
      const sortedMeasures = [...selectedMeasures].sort((a, b) => a - b);
      sortedMeasures.forEach((mIdx) => {
        const measure = score?.measures[mIdx];
        if (measure) {
          measure.notes.forEach((_, nIdx) => {
            notesToPlay.push({ measureIndex: mIdx, noteIndex: nIdx });
          });
        }
      });
    }

    // Initialize playback state
    noteIndexRef.current = 0;
    startTimeRef.current = Date.now();

    // Play each note
    const playNextNote = () => {
      if (noteIndexRef.current >= notesToPlay.length) {
        // Playback complete - check if loop is enabled
        if (playbackState.loopEnabled) {
          noteIndexRef.current = 0;
          startTimeRef.current = Date.now();
          const intervalMs = measureInterval > 0 ? (measureInterval * 60 / tempo) * 1000 : 0;
          playbackTimeoutRef.current = window.setTimeout(playNextNote, intervalMs);
        } else {
          handleStop();
        }
        return;
      }

      const { measureIndex: measureIdx, noteIndex: noteIdx } = notesToPlay[noteIndexRef.current];
      const measure = score?.measures[measureIdx];

      if (!measure || noteIdx >= measure.notes.length) {
        noteIndexRef.current++;
        playbackTimeoutRef.current = window.setTimeout(playNextNote, 10);
        return;
      }

      // Update current measure
      setCurrentMeasure(measureIdx);

      // Play the note
      const note = measure.notes[noteIdx];
      if (isAudioEnabled && !note.isRest) {
        audioActions.playNote(note.pitch, note.duration);
      }

      // Schedule next note
      const noteDuration = noteDurationToSeconds(note.duration, tempo) * 1000;
      noteIndexRef.current++;
      playbackTimeoutRef.current = window.setTimeout(playNextNote, noteDuration);
    };

    playNextNote();
  }, [selectedMeasures, selectedNotes, score, tempo, measureInterval, isAudioEnabled, audioActions, playbackActions, playbackState.loopEnabled]);

  // Stop playback
  const handleStop = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    playbackActions.stop();
    setCurrentMeasure(-1);
    noteIndexRef.current = 0;
  }, [playbackActions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (playbackState.isPlaying) {
            handleStop();
          } else {
            handlePlay();
          }
          break;
        case 'Escape':
          handleStop();
          selectionActions.clearSelection();
          break;
        case 'ArrowLeft':
          if (selectedMeasures.length > 0) {
            e.preventDefault();
            const minMeasure = Math.min(...selectedMeasures);
            if (minMeasure > 0) {
              selectionActions.selectMeasure(minMeasure - 1);
            }
          }
          break;
        case 'ArrowRight':
          if (selectedMeasures.length > 0) {
            e.preventDefault();
            const maxMeasure = Math.max(...selectedMeasures);
            if (maxMeasure < totalMeasures - 1) {
              selectionActions.selectMeasure(maxMeasure + 1);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState.isPlaying, selectedMeasures, totalMeasures, selectionActions, handlePlay, handleStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, []);

  const instrumentDisplay = getInstrumentDisplay();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header
        isAudioEnabled={isAudioEnabled}
        isLoadingAudio={isLoadingAudio}
        instrumentDisplay={instrumentDisplay}
        onEnableAudio={handleEnableAudio}
        onSwitchInstrument={handleSwitchInstrument}
        onOpenFileLoader={() => setShowFileLoader(true)}
      />

      {/* Main Content - Scrollable container */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6" role="main" aria-label="Music notation display">
          {/* Score Info */}
          <ScoreInfo
            title={score?.title || 'Twinkle Twinkle Little Star'}
            composer={score?.composer}
            timeSignature={score?.timeSignature || '4/4'}
            tempo={score?.tempo || 120}
          />

          {/* Notation Display */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <NotationDisplay
              score={score}
              currentMeasure={currentMeasure}
              selectedNotes={selectedNotes}
              onNoteSelect={selectionActions.selectNotes}
              className="min-h-62.5"
            />
          </div>

          {/* Selection Info */}
          <SelectionInfo
            selectedMeasures={selectedMeasures}
            selectedNotes={selectedNotes}
            onClearSelection={selectionActions.clearSelection}
          />
        </main>
      </div>

      {/* Playback Controls - Sticky at bottom */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <PlaybackControls
          isPlaying={playbackState.isPlaying}
          canPlay={selectedNotes.length > 0 && isAudioEnabled}
          onPlay={handlePlay}
          onPause={handleStop}
          onStop={handleStop}
          onToggleLoop={playbackActions.toggleLoop}
          loopEnabled={playbackState.loopEnabled}
          tempo={tempo}
          onTempoChange={setTempo}
          instrument={audioState.currentInstrument}
          onInstrumentChange={(inst: InstrumentType) => audioActions.loadInstrument(inst)}
          measureInterval={measureInterval}
          onMeasureIntervalChange={setMeasureInterval}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        selectedMeasures={selectedMeasures}
        tempo={tempo}
        instrumentName={instrumentDisplay.name}
        measureInterval={measureInterval}
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
      />
    </div>
  );
}

export default App;
