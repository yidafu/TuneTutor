/**
 * TempoSlider - Tempo adjustment with range slider and numeric input
 */

import { useState, useCallback } from 'react';
import type { TranslationSet } from '../../locales';

interface TempoSliderProps {
  tempo: number;
  onTempoChange: (tempo: number) => void;
  t: TranslationSet;
}

export function TempoSlider({
  tempo,
  onTempoChange,
  t,
}: TempoSliderProps) {
  const [editingTempo, setEditingTempo] = useState<string>(String(tempo));
  const [isEditing, setIsEditing] = useState(false);

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
    <div className="flex items-center gap-3 flex-1">
      <label htmlFor="tempo-slider" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {t.tempo}
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
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{t.bpm}</span>
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
  );
}

export default TempoSlider;
