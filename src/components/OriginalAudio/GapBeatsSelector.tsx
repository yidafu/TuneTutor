/**
 * GapBeatsSelector - Empty-beat selector for the original-audio slice loop.
 * Mirrors the LoopSkipSelector interaction (buttons 1-8, click active to reset).
 */

import { useCallback } from 'react';
import type { TranslationSet } from '../../locales';

interface GapBeatsSelectorProps {
  value: number;
  onChange: (beats: number) => void;
  t: TranslationSet;
}

export function GapBeatsSelector({ value, onChange, t }: GapBeatsSelectorProps) {
  const handleChange = useCallback((beats: number) => {
    if (value === beats) {
      onChange(0);
    } else {
      onChange(beats);
    }
  }, [value, onChange]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{t.gapBeats}</span>
      <div className="flex gap-1" role="group" aria-label="Select empty beats before repeat">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((beat) => (
          <button
            key={beat}
            onClick={() => handleChange(beat)}
            className={`w-7 h-7 rounded-md font-medium text-xs transition-colors ${
              value >= beat
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            aria-label={`${beat} empty beat${beat > 1 ? 's' : ''}`}
            aria-pressed={value >= beat}
          >
            {beat}
          </button>
        ))}
      </div>
      <output className="text-xs text-gray-500 w-12 text-right">
        {value > 0 ? `${value}b` : t.off}
      </output>
    </div>
  );
}

export default GapBeatsSelector;
