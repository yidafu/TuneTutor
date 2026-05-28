/**
 * PlaybackControls - Main playback control component
 */

import type { TranslationSet } from '../../locales';
import type { MetronomeSoundType } from '../../types/playback';
import { TempoSlider } from './TempoSlider';
import { TransportButtons } from './TransportButtons';
import { LoopSkipSelector } from './LoopSkipSelector';
import { MetronomeToggle } from './MetronomeToggle';

export interface LoopConfig {
  skipBeats: number;  // M: skip M beats
}

export interface PlaybackControlsProps {
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  loopConfig: LoopConfig;
  onLoopConfigChange: (config: LoopConfig) => void;
  metronomeEnabled: boolean;
  metronomeSound: MetronomeSoundType;
  metronomeStrongVolume: number;
  metronomeWeakVolume: number;
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
  onPause,
  onStop,
  tempo,
  onTempoChange,
  loopConfig,
  onLoopConfigChange,
  metronomeEnabled,
  metronomeSound,
  metronomeStrongVolume,
  metronomeWeakVolume,
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
            onPause={onPause}
            onStop={onStop}
            t={t}
          />
          <MetronomeToggle
            enabled={metronomeEnabled}
            sound={metronomeSound}
            strongVolume={metronomeStrongVolume}
            weakVolume={metronomeWeakVolume}
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
