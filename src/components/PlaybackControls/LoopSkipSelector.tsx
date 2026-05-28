/**
 * LoopSkipSelector - Skip beats selector for loop playback
 */

import { useCallback } from 'react';
import type { TranslationSet } from '../../locales';
import type { LoopConfig } from './PlaybackControls';

interface LoopSkipSelectorProps {
  loopConfig: LoopConfig;
  onLoopConfigChange: (config: LoopConfig) => void;
  t: TranslationSet;
}

export function LoopSkipSelector({
  loopConfig,
  onLoopConfigChange,
  t,
}: LoopSkipSelectorProps) {
  const handleSkipBeatsChange = useCallback((beats: number) => {
    if (loopConfig.skipBeats === beats) {
      onLoopConfigChange({ skipBeats: 0 });
    } else {
      onLoopConfigChange({ skipBeats: beats });
    }
  }, [loopConfig, onLoopConfigChange]);

  return (
    <div className="flex items-center gap-3 flex-1">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{t.loopSkip}</span>
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
        {loopConfig.skipBeats > 0 ? `${loopConfig.skipBeats}b` : t.off}
      </output>
    </div>
  );
}

export default LoopSkipSelector;
