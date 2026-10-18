/**
 * 基准翻译集（en-US）。其余三语言以此为类型约束，
 * tests/locales/index.test.ts 另在运行时断言四语言 key 集合一致。
 */
export const enUS = {
  // Header
  appSubtitle: 'Sheet Music Practice Player',
  navScore: 'Score',
  navAudio: 'Original Audio',

  // 乐谱页工具栏
  libraryTitle: 'My Scores',
  loadScore: 'Load Score',

  // 乐器（7 种采样音色）
  instrumentPiano: 'Piano',
  instrumentSaxophone: 'Saxophone',
  instrumentGuitar: 'Guitar',
  instrumentBass: 'Bass',
  instrumentViolin: 'Violin',
  instrumentFlute: 'Flute',
  instrumentTrumpet: 'Trumpet',

  // 示范曲信息（内置《小星星》回落）
  demoScoreTitle: 'Twinkle, Twinkle, Little Star',
  demoScoreComposer: 'Traditional',
  keyCMajor: 'C major',

  // 纸面乐谱卡
  notationPlaceholder: 'Sheet music will render here — the rendering/playback engine is not wired up yet.',
  notationFootInfo: 'OSMD · SVG render · responsive width',

  // 选择信息
  selectionNone: 'No selection',
  selectionHint: 'Click a note to select its measure · double-click two notes to set a phrase',

  // 走带
  play: 'Play',
  stop: 'Stop',

  // 速度
  tempoLabel: 'Tempo',
  bpmUnit: 'BPM',

  // 节拍器
  metronomeLabel: 'Metronome',
  metronomeOn: 'On',
  metronomeOff: 'Off',
  metronomeSettings: 'Metronome settings',
  soundName: 'Sound',
  metroSoundClassic: 'Classic',
  metroSoundDigital: 'Digital',
  metroSoundKick: 'Kick',
  metroSoundClick: 'Click',
  strongVolume: 'Strong beat volume',
  weakVolume: 'Weak beat volume',

  // 空拍（循环跳过）
  skipLabel: 'Gap beats',
  skipPerLoop: (n: number) => `${n}-beat gap`,
  skipOff: 'Off',
  skipBeatsShort: (n: number) => `${n} ${n === 1 ? 'beat' : 'beats'}`,

  // 状态栏
  statusSelection: 'Selection',
  statusSkip: 'Skip',
  statusInstrument: 'Instrument',
  statusPlaying: 'Playing',
  statusStopped: 'Stopped',

  // 加载乐谱弹窗
  loadScoreTitle: 'Load Score',
  dropMain: 'Drop a file here, or',
  dropBrowse: 'browse files',
  dropHint: 'Supports .musicxml · .xml · .mxl — parsed locally in your browser',
  recentFiles: 'Recent files',
  recentEmpty: 'No recent files yet',
  delete: 'Delete',
  localNote: 'Files are stored locally in your browser (IndexedDB)',
  closeHint: 'Close',

  // 原曲页
  audioDropMain: 'Drop an audio file here, or',
  audioDropHint: 'Supports mp3 · wav · ogg · m4a — processed locally in your browser',
  audioStubHint: 'Demo mode: click to load a sample track (no sound yet)',
  removeAudio: 'Remove audio',
  sliceTag: (start: string, end: string) => `Slice ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `LOOP ${seconds}s`,
  loopRange: (start: string, end: string) => `Loop ${start} → ${end}`,
  gapInfo: (beats: number, duration: string) => `+${beats} beats of silence per round (≈ ${duration})`,
  waveHint: 'Drag on the waveform to create a slice · drag its edges to adjust · double-click to remove',
  demoAudioName: 'Sample track.mp3',

  // 皮肤切换（skin-switching.html v1.1 §③：四语言全量硬约束）
  theme: {
    label: 'Theme',
    group: {
      classic: 'Classic',
      antique: 'Chinese Classic',
    },
    paper: 'Paper Ink',
    nocturne: 'Nocturne',
    walnut: 'Walnut',
    celadon: 'Celadon',
    stage: 'Stage',
    cobalt: 'Blue & White',
    palace: 'Palace Red',
    rosewood: 'Rosewood',
    lacquer: 'Black Lacquer',
    appliedHint: 'Applied instantly · saved locally',
  },
}

export type TranslationSet = typeof enUS
