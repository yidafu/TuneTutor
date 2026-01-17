/**
 * PlaybackControls - Main playback control component
 */

import { useState, useCallback } from 'react';

interface LoopConfig {
  skipBeats: number;  // M: skip M beats
}

interface PlaybackControlsProps {
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  loopConfig: LoopConfig;
  onLoopConfigChange: (config: LoopConfig) => void;
}

export function PlaybackControls({
  isPlaying,
  canPlay,
  onPlay,
  onPause,
  onStop,
  tempo,
  onTempoChange,
  loopConfig,
  onLoopConfigChange,
}: PlaybackControlsProps) {
  const [editingTempo, setEditingTempo] = useState<string>(String(tempo));
  const [isEditing, setIsEditing] = useState(false);

  const handleSkipBeatsChange = useCallback((beats: number) => {
    if (loopConfig.skipBeats === beats) {
      onLoopConfigChange({ skipBeats: 0 });
    } else {
      onLoopConfigChange({ skipBeats: beats });
    }
  }, [loopConfig, onLoopConfigChange]);

  const handleTempoInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTempo(e.target.value);
  }, []);

  const handleTempoInputBlur = useCallback(() => {
    setIsEditing(false);
    const value = parseInt(editingTempo, 10);
    if (!isNaN(value) && value >= 40 && value <= 240) {
      onTempoChange(value);
    } else {
      setEditingTempo(String(tempo));
    }
  }, [editingTempo, tempo, onTempoChange]);

  const handleTempoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  const handleTempoFocus = useCallback(() => {
    setIsEditing(true);
    setEditingTempo(String(tempo));
  }, [tempo]);

  return (
    <div className="bg-white border-t border-gray-200 p-4" role="region" aria-label="Playback controls">
      <div className="max-w-7xl mx-auto">
        {/* Single row layout: Tempo | Play/Stop | Loop Skip */}
        <div className="flex flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Tempo Slider */}
          <div className="flex items-center gap-3 flex-1">
            <label htmlFor="tempo-slider" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Tempo
            </label>
            <div className="flex-1 flex items-center gap-2">
              <input
                id="tempo-slider"
                type="range"
                min="40"
                max="240"
                value={isEditing ? parseInt(editingTempo, 10) || tempo : tempo}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onTempoChange(value);
                  setEditingTempo(String(value));
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                aria-label="Tempo adjustment"
              />
              <span className="text-sm font-bold text-gray-900 whitespace-nowrap">BPM</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={isEditing ? editingTempo : tempo}
                onChange={handleTempoInputChange}
                onFocus={handleTempoFocus}
                onBlur={handleTempoInputBlur}
                onKeyDown={handleTempoKeyDown}
                className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Tempo BPM"
              />
            </div>
          </div>

          {/* Play/Stop Buttons */}
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
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={onStop}
              disabled={!isPlaying}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Stop playback"
            >
              <span aria-hidden="true">⏹️</span>
              Stop
            </button>
          </div>

          {/* Loop Skip */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Loop Skip</span>
            <div className="flex gap-1" role="group" aria-label="Select skip beats">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((beat) => (
                <button
                  key={beat}
                  onClick={() => handleSkipBeatsChange(beat)}
                  className={`w-7 h-7 rounded-md font-medium text-xs transition-colors ${
                    loopConfig.skipBeats >= beat
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  aria-label={`Skip ${beat} beat${beat > 1 ? 's' : ''}`}
                  aria-pressed={loopConfig.skipBeats >= beat}
                >
                  {beat}
                </button>
              ))}
            </div>
            <output className="text-xs text-gray-500 w-12 text-right">
              {loopConfig.skipBeats > 0 ? `${loopConfig.skipBeats}b` : 'Off'}
            </output>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaybackControls;
