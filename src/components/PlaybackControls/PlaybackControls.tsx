import LoopSkipSelector from './LoopSkipSelector'
import MetronomeToggle from './MetronomeToggle'
import TempoSlider from './TempoSlider'
import TransportButtons from './TransportButtons'
import type { MetronomeSoundType } from '../../types/audio'

interface PlaybackControlsProps {
  tempo: number
  onTempoChange: (tempo: number) => void
  playing: boolean
  onPlayToggle: () => void
  onStop: () => void
  metronomeOn: boolean
  onMetronomeToggle: () => void
  metroSound: MetronomeSoundType
  onMetroSoundChange: (sound: MetronomeSoundType) => void
  strongVolume: number
  onStrongVolumeChange: (volume: number) => void
  weakVolume: number
  onWeakVolumeChange: (volume: number) => void
  skipBeats: number
  onSkipBeatsChange: (beats: number) => void
}

/** 播放控制条：速度 │ 走带 │ 节拍器 │ 空拍。吸底通栏（ui-design.html「控制条吸底」） */
export default function PlaybackControls(props: PlaybackControlsProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-[22px] gap-y-3 border-t border-line bg-surface-2 px-4 py-3 sm:px-[22px]">
      <div className="min-w-0 flex-1 basis-[300px]">
        <TempoSlider value={props.tempo} onChange={props.onTempoChange} />
      </div>
      <TransportButtons
        playing={props.playing}
        onPlayToggle={props.onPlayToggle}
        onStop={props.onStop}
      />
      <MetronomeToggle
        on={props.metronomeOn}
        onToggle={props.onMetronomeToggle}
        sound={props.metroSound}
        onSoundChange={props.onMetroSoundChange}
        strongVolume={props.strongVolume}
        onStrongVolumeChange={props.onStrongVolumeChange}
        weakVolume={props.weakVolume}
        onWeakVolumeChange={props.onWeakVolumeChange}
      />
      <LoopSkipSelector value={props.skipBeats} onChange={props.onSkipBeatsChange} />
    </div>
  )
}
