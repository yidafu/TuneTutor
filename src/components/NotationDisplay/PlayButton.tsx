/**
 * PlayButton - 播放按钮组件
 */

import React from 'react';
import styles from './NotationDisplay.module.css';
import type { SelectedNote } from '../../types/notation';

interface PlayButtonProps {
  selectedNotes: SelectedNote[];
  onPlay: (notes: SelectedNote[]) => void;
}

export function PlayButton({ selectedNotes, onPlay }: PlayButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(selectedNotes);
  };

  if (selectedNotes.length === 0) return null;

  return (
    <button className={styles.playButton} onClick={handleClick}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      播放 ({selectedNotes.length})
    </button>
  );
}
