/**
 * tonejs-instrument-*-mp3 包族类型声明（docs/audio.md §4）。
 * Makefully-Studios 打包发布，无自带 .d.ts；实现均为 `class extends Tone.Sampler`，
 * 构造参数只消费 minify / onload（minify 本项目不用，决策 A6）。
 */

declare module 'tonejs-instrument-piano-mp3' {
  import type { Sampler } from 'tone'
  const PianoMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default PianoMp3
}

declare module 'tonejs-instrument-saxophone-mp3' {
  import type { Sampler } from 'tone'
  const SaxophoneMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default SaxophoneMp3
}

declare module 'tonejs-instrument-guitar-acoustic-mp3' {
  import type { Sampler } from 'tone'
  const GuitarAcousticMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default GuitarAcousticMp3
}

declare module 'tonejs-instrument-bass-electric-mp3' {
  import type { Sampler } from 'tone'
  const BassElectricMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default BassElectricMp3
}

declare module 'tonejs-instrument-violin-mp3' {
  import type { Sampler } from 'tone'
  const ViolinMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default ViolinMp3
}

declare module 'tonejs-instrument-flute-mp3' {
  import type { Sampler } from 'tone'
  const FluteMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default FluteMp3
}

declare module 'tonejs-instrument-trumpet-mp3' {
  import type { Sampler } from 'tone'
  const TrumpetMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default TrumpetMp3
}

declare module 'tonejs-instrument-clarinet-mp3' {
  import type { Sampler } from 'tone'
  const ClarinetMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default ClarinetMp3
}

declare module 'tonejs-instrument-french-horn-mp3' {
  import type { Sampler } from 'tone'
  const FrenchHornMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default FrenchHornMp3
}

declare module 'tonejs-instrument-trombone-mp3' {
  import type { Sampler } from 'tone'
  const TromboneMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default TromboneMp3
}

declare module 'tonejs-instrument-cello-mp3' {
  import type { Sampler } from 'tone'
  const CelloMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default CelloMp3
}

declare module 'tonejs-instrument-guitar-nylon-mp3' {
  import type { Sampler } from 'tone'
  const GuitarNylonMp3: new (options?: { minify?: boolean; onload?: () => void }) => Sampler
  export default GuitarNylonMp3
}
