/**
 * useKeyboardShortcuts - Keyboard shortcuts hook
 */

import { useEffect, useCallback } from 'react';
import type { NoteSelectionActions } from './useNoteSelection';

interface UseKeyboardShortcutsOptions {
  isPlaying: boolean;
  selectedNotes: { measureIndex: number; noteIndex: number }[];
  totalMeasures: number;
  selectionActions: NoteSelectionActions;
  onPlay: () => void;
  onStop: () => void;
}

export function useKeyboardShortcuts({
  isPlaying,
  selectedNotes,
  totalMeasures,
  selectionActions,
  onPlay,
  onStop,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (isPlaying) {
          onStop();
        } else {
          onPlay();
        }
        break;
      case 'Escape':
        onStop();
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
  }, [isPlaying, selectedNotes, totalMeasures, selectionActions, onPlay, onStop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;