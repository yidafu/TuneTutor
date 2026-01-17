/**
 * Traditional Chinese translations
 */
export const zhTW = {
  // Header
  appTitle: '樂譜播放器',
  loadFile: '載入檔案',

  // Instruments
  instrument_piano: '鋼琴',
  instrument_saxophone: '薩克斯風',
  instrument_guitar: '吉他',
  instrument_bass: '貝斯',
  instrument_violin: '小提琴',
  instrument_flute: '長笛',
  instrument_trumpet: '小號',

  // PlaybackControls
  tempo: '速度',
  bpm: '拍/分',
  play: '播放',
  pause: '暫停',
  stop: '停止',
  loopSkip: '循環跳過',
  off: '關閉',

  // StatusBar
  noSelection: '未選擇',
  selected: '已選擇:',
  tempoLabel: '速度:',
  instrument: '樂器:',
  loopConfigSkip: '跳過: {0}',

  // ScoreInfo
  composer: '作曲:',

  // SelectionInfo
  clickToSelect: '點擊音符選擇',
  note: '個音符',
  notes: '個音符',
  clearSelection: '清除選擇',

  // FileLoaderModal
  loadSheetMusic: '載入樂譜',
  supportedFormats: '支援格式: .musicxml, .xml',

  // Selection formatting
  measure: '第 {0} 小節',
  measures: '第 {0}-{1} 小節',

  // Language switcher
  language: '語言',
  chinese: '繁體中文',
  english: 'English',
  french: 'Français',
} as const;

export type TraditionalChinese = typeof zhTW;
