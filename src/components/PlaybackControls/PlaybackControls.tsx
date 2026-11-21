import * as stylex from '@stylexjs/stylex'
import LoopSkipSelector from './LoopSkipSelector'
import MetronomeToggle from './MetronomeToggle'
import TempoSlider from './TempoSlider'
import TransportButtons from './TransportButtons'
import type { MetronomeSoundType } from '../../types/audio'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: '22px',
    rowGap: '12px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    backgroundColor: 'var(--color-surface-2)',
    paddingInline: '16px',
    paddingBlock: '12px',
    '@media (min-width: 640px)': {
      paddingInline: '22px',
    },
    // 手机竖屏（phone-compat P6）：速度+走带一行、节拍器一行、空拍整行，
    // 收紧间距压低吸底控制条高度，把纵向空间还给谱面
    '@media (max-width: 639px)': {
      columnGap: '12px',
      rowGap: '8px',
      paddingBlock: '10px',
    },
  },
  sliderCell: {
    minWidth: 0,
    flex: 1,
    flexBasis: '300px',
    '@media (max-width: 639px)': {
      flexBasis: '240px',
    },
  },
})

interface PlaybackControlsProps {
  tempo: number
  onTempoChange: (tempo: number) => void
  playing: boolean
  onPlayToggle: () => void
  /** 采样加载中（usePlayback 样本就绪状态透传，走带按钮加载态） */
  samplesLoading: boolean
  /** 采样加载失败（走带按钮失败提示 + 重试） */
  samplesFailed: boolean
  onRetrySamples: () => void
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
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.sliderCell)}>
        <TempoSlider value={props.tempo} onChange={props.onTempoChange} />
      </div>
      <TransportButtons
        playing={props.playing}
        onPlayToggle={props.onPlayToggle}
        samplesLoading={props.samplesLoading}
        samplesFailed={props.samplesFailed}
        onRetrySamples={props.onRetrySamples}
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
