/**
 * useKeyboardShortcuts - Keyboard shortcuts hook
 */

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}

export function useKeyboardShortcuts({
  isPlaying,
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
        break;
    }
  }, [isPlaying, onPlay, onStop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;