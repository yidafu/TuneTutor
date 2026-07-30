/**
 * PlaybackControls - Main playback control component
 */

import type { TranslationSet } from '../../locales';
import type { LoopConfig, MetronomeConfig, MetronomeSoundType } from '../../types/playback';
import { TempoSlider } from './TempoSlider';
import { TransportButtons } from './TransportButtons';
import { LoopSkipSelector } from './LoopSkipSelector';
import { MetronomeToggle } from './MetronomeToggle';

export interface PlaybackControlsProps {
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onStopPlaying: () => void;
  onStop: () => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  loopConfig: LoopConfig;
  onLoopConfigChange: (config: LoopConfig) => void;
  metronomeConfig: MetronomeConfig;
  onMetronomeToggle: () => void;
  onMetronomeSoundChange: (sound: MetronomeSoundType) => void;
  onMetronomeStrongVolumeChange: (volume: number) => void;
  onMetronomeWeakVolumeChange: (volume: number) => void;
  t: TranslationSet;
}

export function PlaybackControls({
  isPlaying,
  canPlay,
  onPlay,
  onStopPlaying,
  onStop,
  tempo,
  onTempoChange,
  loopConfig,
  onLoopConfigChange,
  metronomeConfig,
  onMetronomeToggle,
  onMetronomeSoundChange,
  onMetronomeStrongVolumeChange,
  onMetronomeWeakVolumeChange,
  t,
}: PlaybackControlsProps) {
  return (
    <div className="bg-white border-t border-gray-200 p-4" role="region" aria-label="Playback controls">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-row items-center justify-between gap-4 sm:gap-6">
          <TempoSlider tempo={tempo} onTempoChange={onTempoChange} t={t} />
          <TransportButtons
            isPlaying={isPlaying}
            canPlay={canPlay}
            onPlay={onPlay}
            onStopPlaying={onStopPlaying}
            onStop={onStop}
            t={t}
          />
          <MetronomeToggle
            config={metronomeConfig}
            onToggle={onMetronomeToggle}
            onSoundChange={onMetronomeSoundChange}
            onStrongVolumeChange={onMetronomeStrongVolumeChange}
            onWeakVolumeChange={onMetronomeWeakVolumeChange}
            t={t}
          />
          <LoopSkipSelector
            loopConfig={loopConfig}
            onLoopConfigChange={onLoopConfigChange}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

export default PlaybackControls;
