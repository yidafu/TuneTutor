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

  // 乐器（12 种采样音色）
  instrumentPiano: 'Piano',
  instrumentSaxophone: 'Saxophone',
  instrumentClarinet: 'Clarinet',
  instrumentFlute: 'Flute',
  instrumentTrumpet: 'Trumpet',
  instrumentFrenchHorn: 'French Horn',
  instrumentTrombone: 'Trombone',
  instrumentViolin: 'Violin',
  instrumentCello: 'Cello',
  instrumentGuitar: 'Acoustic Guitar',
  instrumentGuitarNylon: 'Classical Guitar',
  instrumentBass: 'Bass',

  // 示范曲信息（内置《小星星》回落）
  untitledScore: 'Untitled score',

  // 纸面乐谱卡
  notationPlaceholder: 'Sheet music will render here — the rendering/playback engine is not wired up yet.',
  notationFootInfo: 'OSMD · SVG render · responsive width',
  notationZoomIn: 'Zoom in score',
  notationZoomOut: 'Zoom out score',
  // 手机触屏框选开关（selection.md §4.7）
  notationBoxSelect: 'Box select',
  notationBoxSelectHint: 'On: one-finger drag box-selects. Off: one finger scrolls the score.',

  // 选择信息
  selectionNone: 'No selection',
  selectionHint:
    'Click a note to select its measure · double-click two notes for a phrase loop · drag on empty space to box-select',
  selectionPhrase: 'Phrase',
  selectionMeasure: 'Measure',
  selectionBox: 'Box selection',
  selectionMeasures: (from: number, to: number) =>
    from === to ? `Measure ${from}` : `Measures ${from}–${to}`,
  selectionNoteCount: (n: number) => `${n} ${n === 1 ? 'note' : 'notes'}`,
  selectionClear: 'Clear selection',
  selectionInvalid: 'No playable range in this selection',

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

  // 乐谱导入错误（docs/musicxml.md §6，E1–E4）
  importing: 'Parsing score…',
  errorCorruptArchive: 'Corrupted archive: this .mxl file could not be opened',
  errorNotMusicXML: 'Unsupported format: only MusicXML score-partwise files are supported',
  errorParseFailed: 'Failed to parse this score file',
  errorUnsupportedEncoding: 'Unsupported encoding: only UTF-8 MusicXML files are supported',

  // 原曲页
  audioDropMain: 'Drop an audio file here, or',
  audioDropHint: 'Supports mp3 · wav · ogg · m4a — processed locally in your browser',
  removeAudio: 'Remove audio',
  sliceTag: (start: string, end: string) => `Slice ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `LOOP ${seconds}s`,
  loopRange: (start: string, end: string) => `Loop ${start} → ${end}`,
  gapInfo: (beats: number, duration: string) => `+${beats} beats of silence per round (≈ ${duration})`,
  waveHint: 'Drag on the waveform to create a slice · drag its body to move · drag its edges to fine-tune · double-click to remove · two-finger pan & pinch to zoom',
  audioDropOverlay: 'Drop to load audio',
  zoomOut: 'Zoom out waveform',
  zoomIn: 'Zoom in waveform',
  zoomFit: 'Fit to window',
  audioLibraryTitle: 'Audio Library',
  recentAudio: 'Recent audio',
  audioRecentEmpty: 'No audio imported yet',
  importingAudio: 'Importing audio…',

  // 音频导入错误（docs/audio.md §5.1 双重校验）
  errorUnsupportedAudio: 'Unsupported audio file: use mp3, wav, ogg or m4a',
  errorAudioDecode: 'Could not decode this audio file',

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
