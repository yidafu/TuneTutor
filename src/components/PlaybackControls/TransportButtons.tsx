/**
 * TransportButtons - Play/Pause and Stop buttons
 */

import type { TranslationSet } from '../../locales';

interface TransportButtonsProps {
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  t: TranslationSet;
}

export function TransportButtons({
  isPlaying,
  canPlay,
  onPlay,
  onPause,
  onStop,
  t,
}: TransportButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-1" role="group" aria-label="Transport controls">
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={!canPlay && !isPlaying}
        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
          isPlaying
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
        aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
      >
        <span aria-hidden="true">{isPlaying ? '⏸️' : '▶️'}</span>
        {isPlaying ? t.pause : t.play}
      </button>

      <button
        onClick={onStop}
        disabled={!isPlaying}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label="Stop playback"
      >
        <span aria-hidden="true">⏹️</span>
        {t.stop}
      </button>
    </div>
  );
}

export default TransportButtons;
