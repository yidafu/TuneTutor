/**
 * Chinese translations
 */
export const zhCN = {
  // Header
  appTitle: '乐谱播放器',
  loadFile: '加载文件',

  // Instruments
  instrument_piano: '钢琴',
  instrument_saxophone: '萨克斯',
  instrument_guitar: '吉他',
  instrument_bass: '贝斯',
  instrument_violin: '小提琴',
  instrument_flute: '长笛',
  instrument_trumpet: '小号',

  // PlaybackControls
  tempo: '速度',
  bpm: '拍/分',
  play: '播放',
  pause: '暂停',
  stop: '停止',
  loopSkip: '循环跳过',
  off: '关闭',

  // StatusBar
  noSelection: '未选择',
  selected: '已选择:',
  tempoLabel: '速度:',
  instrument: '乐器:',
  loopConfigSkip: '跳过: {0}',

  // ScoreInfo
  composer: '作曲:',

  // SelectionInfo
  clickToSelect: '点击音符选择',
  note: '个音符',
  notes: '个音符',
  clearSelection: '清除选择',

  // FileLoaderModal
  loadSheetMusic: '加载乐谱',
  supportedFormats: '支持格式: .musicxml, .xml',

  // Selection formatting
  measure: '第 {0} 小节',
  measures: '第 {0}-{1} 小节',

  // Language switcher
  language: '语言',
  chinese: '繁體中文',
  english: 'English',
  french: 'Français',
} as const;

export type Chinese = typeof zhCN;
