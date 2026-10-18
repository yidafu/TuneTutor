import type { TranslationSet } from './en-US'

export const zhTW: TranslationSet = {
  // Header
  appSubtitle: '樂譜練習播放器',
  navScore: '樂譜',
  navAudio: '原曲',

  // 樂譜頁工具列
  libraryTitle: '我的樂譜',
  loadScore: '載入樂譜',

  // 樂器
  instrumentPiano: '鋼琴',
  instrumentSaxophone: '薩克斯風',
  instrumentGuitar: '吉他',
  instrumentBass: '貝斯',
  instrumentViolin: '小提琴',
  instrumentFlute: '長笛',
  instrumentTrumpet: '小號',

  // 示範曲資訊
  demoScoreTitle: '小星星',
  demoScoreComposer: '傳統童謠',
  keyCMajor: 'C 大調',

  // 紙面樂譜卡
  notationPlaceholder: '樂譜將在此渲染——渲染與播放引擎尚未接入。',
  notationFootInfo: 'OSMD · SVG 渲染 · 自適應寬度',

  // 選擇資訊
  selectionNone: '未選擇',
  selectionHint: '單擊音符選小節 · 雙擊兩點定樂句',

  // 走帶
  play: '播放',
  stop: '停止',

  // 速度
  tempoLabel: '速度',
  bpmUnit: 'BPM',

  // 節拍器
  metronomeLabel: '節拍器',
  metronomeOn: '開',
  metronomeOff: '關',
  metronomeSettings: '節拍器設定',
  soundName: '音色',
  metroSoundClassic: '經典',
  metroSoundDigital: '電子',
  metroSoundKick: '大鼓',
  metroSoundClick: '敲擊',
  strongVolume: '強拍音量',
  weakVolume: '弱拍音量',

  // 空拍（循環跳過）
  skipLabel: '空拍',
  skipPerLoop: (n: number) => `輪間 ${n} 拍`,
  skipOff: '關閉',
  skipBeatsShort: (n: number) => `${n} 拍`,

  // 狀態列
  statusSelection: '選擇',
  statusSkip: '跳過',
  statusInstrument: '樂器',
  statusPlaying: '播放中',
  statusStopped: '已停止',

  // 載入樂譜彈窗
  loadScoreTitle: '載入樂譜',
  dropMain: '拖放檔案至此處，或',
  dropBrowse: '瀏覽檔案',
  dropHint: '支援 .musicxml · .xml · .mxl，在瀏覽器本地解析',
  recentFiles: '最近檔案',
  recentEmpty: '暫無歷史檔案',
  delete: '刪除',
  localNote: '檔案儲存在本機瀏覽器（IndexedDB）',
  closeHint: '關閉',

  // 原曲頁
  audioDropMain: '拖放音訊檔案至此處，或',
  audioDropHint: '支援 mp3 · wav · ogg · m4a，在瀏覽器本地處理',
  audioStubHint: '示範模式：點擊載入範例音訊（暫無聲音）',
  removeAudio: '移除音訊',
  sliceTag: (start: string, end: string) => `切片 ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `循環 ${seconds} 秒`,
  loopRange: (start: string, end: string) => `循環區間 ${start} → ${end}`,
  gapInfo: (beats: number, duration: string) => `每輪 +${beats} 拍靜音（約 ${duration}）`,
  waveHint: '拖拽波形新建切片 · 拖動邊界微調 · 雙擊移除',
  demoAudioName: '範例音訊.mp3',

  // 皮膚切換
  theme: {
    label: '皮膚',
    group: {
      classic: '經典',
      antique: '古風',
    },
    paper: '紙墨',
    nocturne: '夜曲',
    walnut: '暖木',
    celadon: '青瓷',
    stage: '演奏會',
    cobalt: '青花',
    palace: '宮牆',
    rosewood: '紅木',
    lacquer: '玄漆',
    appliedHint: '即時生效 · 記憶在本機',
  },
}
