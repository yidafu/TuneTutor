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
import { DURATION_TO_BEATS } from './types/notation';
import type { StoredFile } from './types/storedFile';
import type { InstrumentType } from './types/audio';
import { INSTRUMENTS } from './types/audio';
import { createDemoScore, getRowConfigs, getPlaybackIndicatorX, getIndicatorRowBounds } from './utils/notation';
import { createPlaybackIndicator, removePlaybackIndicator, getNotationContainerElement } from './components/NotationDisplay/NotationDisplay';

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
  const [score, setScore] = useState<ParsedScore>(createDemoScore());
  const [showFileLoader, setShowFileLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempo, setTempo] = useState(60);
  const [currentMeasure, setCurrentMeasure] = useState(-1);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>(getSavedInstrument);
  const [loopConfig, setLoopConfig] = useState({ skipBeats: 0 });

  // Use the unified note selection hook
  const totalMeasures = score?.measures.length || 8;
  const [selectionState, selectionActions] = useNoteSelection(totalMeasures, []);
  const { selectedNotes } = selectionState;

  // Use the audio engine
  const [audioState, audioActions] = useAudioEngine();
  // Ref to store audioActions - updated on every render
  const audioActionsRef = useRef(audioActions);
  useEffect(() => {
    audioActionsRef.current = audioActions;
  }, [audioActions]);

  // Initialize audio and load default instrument on mount
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
    // Delay slightly to ensure audioActionsRef is properly initialized
    const timer = setTimeout(initAudio, 0);
    return () => {
      clearTimeout(timer);
      mounted = false;
    };
  }, [selectedInstrument]); // Include selectedInstrument as dependency

  // Use the playback hook
  const [playbackState, playbackActions] = usePlayback();
  // Ref to store playbackActions - updated on every render
  const playbackActionsRef = useRef(playbackActions);
  useEffect(() => {
    playbackActionsRef.current = playbackActions;
  }, [playbackActions]);

  // Refs for playback
  const playbackTimeoutRef = useRef<number | null>(null);
  const noteIndexRef = useRef(0);
  const startTimeRef = useRef(0);

  // Refs for smooth indicator animation
  const animationFrameRef = useRef<number | null>(null);
  const currentNoteStartTimeRef = useRef<number>(0);
  const currentNoteDurationRef = useRef<number>(0);

  // Store notesToPlay for animation loop access
  const notesToPlayRef = useRef<{ measureIndex: number; noteIndex: number }[]>([]);

  // Playback indicator element ref
  const indicatorRef = useRef<HTMLDivElement | null>(null);

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

  // Sync loopConfig to playback hook
  useEffect(() => {
    if (loopConfig.skipBeats > 0 && selectedNotes.length > 0 && score) {
      // Calculate beat range from selected notes
      const sortedNotes = [...selectedNotes].sort((a, b) => {
        if (a.measureIndex !== b.measureIndex) {
          return a.measureIndex - b.measureIndex;
        }
        return a.noteIndex - b.noteIndex;
      });

      let currentBeat = 0;
      let startBeat = 0;
      let endBeat = 0;

      // First pass: find startBeat from first note
      for (let m = 0; m < sortedNotes[0].measureIndex; m++) {
        for (const note of score.measures[m].notes) {
          currentBeat += DURATION_TO_BEATS[note.duration] || 1;
        }
      }
      for (let n = 0; n < sortedNotes[0].noteIndex; n++) {
        currentBeat += DURATION_TO_BEATS[score.measures[sortedNotes[0].measureIndex].notes[n].duration] || 1;
      }
      startBeat = currentBeat;

      // Second pass: find endBeat from last note
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

  // Enable audio - load saved instrument
  // No longer needed as instrument selection now auto-enables audio

  // Get instrument display name and icon
  const getInstrumentDisplay = useCallback(() => {
    const inst = INSTRUMENTS.find(i => i.type === audioState.currentInstrument);
    return inst || { name: 'Piano', icon: '🎹' };
  }, [audioState.currentInstrument]);

  // Select instrument - saves to localStorage and loads the instrument
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

  // Play the selected notes
  const handlePlay = useCallback(() => {
    if (selectedNotes.length === 0) return;

    // Stop any current playback
    handleStop();

    // Start playback
    playbackActions.play();

    // Use selected notes directly
    const notesToPlay = [...selectedNotes].sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) {
        return a.measureIndex - b.measureIndex;
      }
      return a.noteIndex - b.noteIndex;
    });

    // Initialize playback state
    notesToPlayRef.current = notesToPlay;
    noteIndexRef.current = 0;
    startTimeRef.current = Date.now();

    // Create new indicator for this playback cycle
    const container = getNotationContainerElement();
    removePlaybackIndicator(indicatorRef.current);
    indicatorRef.current = createPlaybackIndicator(container);

    // Immediately position indicator at first note to prevent flash
    if (indicatorRef.current && notesToPlay.length > 0) {
      const firstNote = notesToPlay[0];
      const rowConfigs = getRowConfigs(score?.measures.length || 8, { measuresPerRow: 5 });
      const bounds = getIndicatorRowBounds(firstNote.measureIndex, rowConfigs);
      if (bounds) {
        const indicatorX = getPlaybackIndicatorX(firstNote.measureIndex, firstNote.noteIndex, 0);
        indicatorRef.current.style.left = `${indicatorX}px`;
        indicatorRef.current.style.top = `${bounds.top}px`;
        indicatorRef.current.style.height = `${bounds.bottom - bounds.top}px`;
        indicatorRef.current.style.display = 'block';
      }
    }

    // Play each note
    const playNextNote = () => {
      if (noteIndexRef.current >= notesToPlay.length) {
        // Playback complete - check if loop is enabled
        if (playbackState.loopEnabled) {
          // Cancel any pending animation frame to prevent smooth scroll back
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // 移除当前指示器，创建新的
          removePlaybackIndicator(indicatorRef.current);
          indicatorRef.current = createPlaybackIndicator(getNotationContainerElement());

          // 重置状态
          noteIndexRef.current = 0;
          startTimeRef.current = Date.now();
          setCurrentMeasure(0);
          setCurrentNoteIndex(0);
          currentNoteStartTimeRef.current = Date.now();

          // 立即将indicator位置设置到起点，不带动画
          if (indicatorRef.current && notesToPlay.length > 0) {
            const firstNote = notesToPlay[0];
            const rowConfigs = getRowConfigs(score?.measures.length || 8, { measuresPerRow: 5 });
            const bounds = getIndicatorRowBounds(firstNote.measureIndex, rowConfigs);
            if (bounds) {
              const indicatorX = getPlaybackIndicatorX(firstNote.measureIndex, firstNote.noteIndex, 0);
              indicatorRef.current.style.left = `${indicatorX}px`;
              indicatorRef.current.style.top = `${bounds.top}px`;
              indicatorRef.current.style.height = `${bounds.bottom - bounds.top}px`;
              indicatorRef.current.style.display = 'block';
            }
          }

          // 开始新循环
          playNextNote();
        } else {
          // Position indicator at the end of the last note before stopping
          if (notesToPlay.length > 0 && indicatorRef.current) {
            const lastNote = notesToPlay[notesToPlay.length - 1];
            const rowConfigs = getRowConfigs(score?.measures.length || 8, { measuresPerRow: 5 });
            const bounds = getIndicatorRowBounds(lastNote.measureIndex, rowConfigs);
            if (bounds) {
              const indicatorX = getPlaybackIndicatorX(lastNote.measureIndex, lastNote.noteIndex, 1);
              indicatorRef.current.style.left = `${indicatorX}px`;
              indicatorRef.current.style.top = `${bounds.top}px`;
              indicatorRef.current.style.height = `${bounds.bottom - bounds.top}px`;
              indicatorRef.current.style.display = 'block';
            }
          }

          // Cancel any pending animation frame before stopping
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // 移除指示器并停止
          removePlaybackIndicator(indicatorRef.current);
          indicatorRef.current = null;
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

      // Get the note
      const note = measure.notes[noteIdx];

      // Update current measure and note index
      setCurrentMeasure(measureIdx);
      setCurrentNoteIndex(noteIdx);

      // Record note timing for smooth indicator animation
      const noteDuration = noteDurationToSeconds(note.duration, tempo) * 1000;
      currentNoteDurationRef.current = noteDuration;
      currentNoteStartTimeRef.current = Date.now();

      // Play the note
      if (isAudioEnabled && !note.isRest) {
        audioActions.playNote(note.pitch, note.duration);
      }

      // Schedule next note
      noteIndexRef.current++;
      playbackTimeoutRef.current = window.setTimeout(playNextNote, noteDuration);
    };

    playNextNote();
  }, [selectedNotes, score, tempo, isAudioEnabled, playbackState.loopEnabled]);

  // Stop playback
  const handleStop = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    playbackActionsRef.current.stop();
    setCurrentMeasure(-1);
    setCurrentNoteIndex(-1);
    noteIndexRef.current = 0;
    // Remove indicator
    removePlaybackIndicator(indicatorRef.current);
    indicatorRef.current = null;
  }, []);

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
          if (selectedNotes.length > 0) {
            e.preventDefault();
            const minMeasure = Math.min(...selectedNotes.map(n => n.measureIndex));
            if (minMeasure > 0) {
              selectionActions.selectMeasure(minMeasure - 1);
            }
          }
          break;
        case 'ArrowRight':
          if (selectedNotes.length > 0) {
            e.preventDefault();
            const maxMeasure = Math.max(...selectedNotes.map(n => n.measureIndex));
            if (maxMeasure < totalMeasures - 1) {
              selectionActions.selectMeasure(maxMeasure + 1);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState.isPlaying, selectedNotes, totalMeasures, selectionActions, handlePlay, handleStop]);

  // Smooth indicator animation loop using requestAnimationFrame
  useEffect(() => {
    const updateIndicator = () => {
      if (!playbackState.isPlaying || currentNoteDurationRef.current === 0 || !indicatorRef.current) {
        // Stop animation when not playing
        animationFrameRef.current = null;
        return;
      }

      const elapsed = Date.now() - currentNoteStartTimeRef.current;
      const progress = Math.min(elapsed / currentNoteDurationRef.current, 1);

      // Check if we're at the last note in the playback sequence
      // Note: noteIndexRef.current is incremented BEFORE the next note starts,
      // so we need to check if currentNoteIndex matches the last note's indices
      const lastNote = notesToPlayRef.current[notesToPlayRef.current.length - 1];
      const isLastNote = lastNote &&
        currentMeasure === lastNote.measureIndex &&
        currentNoteIndex === lastNote.noteIndex;

      // Get row configs for current measure
      const rowConfigs = getRowConfigs(score?.measures.length || 8, { measuresPerRow: 5 });
      const bounds = getIndicatorRowBounds(currentMeasure, rowConfigs);

      if (bounds) {
        const indicatorX = getPlaybackIndicatorX(currentMeasure, currentNoteIndex, progress, isLastNote);

        // Directly update indicator DOM position
        indicatorRef.current.style.display = 'block';
        indicatorRef.current.style.left = `${indicatorX}px`;
        indicatorRef.current.style.top = `${bounds.top}px`;
        indicatorRef.current.style.height = `${bounds.bottom - bounds.top}px`;
      }

      animationFrameRef.current = requestAnimationFrame(updateIndicator);
    };

    if (playbackState.isPlaying) {
      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(updateIndicator);
    } else {
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [playbackState.isPlaying, currentMeasure, currentNoteIndex, score]);

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
        selectedInstrument={selectedInstrument}
        onSelectInstrument={handleSelectInstrument}
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
              selectedNotes={selectedNotes}
              onNoteSelect={selectionActions.selectNotes}
              className="min-h-62.5"
            />
          </div>

          {/* Selection Info */}
          <SelectionInfo
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
          tempo={tempo}
          onTempoChange={setTempo}
          loopConfig={loopConfig}
          onLoopConfigChange={setLoopConfig}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        selectedNotes={selectedNotes}
        tempo={tempo}
        instrumentName={instrumentDisplay.name}
        loopConfig={loopConfig}
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
