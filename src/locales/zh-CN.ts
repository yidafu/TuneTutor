import type { TranslationSet } from './en-US'

export const zhCN: TranslationSet = {
  // Header
  appSubtitle: '乐谱练习播放器',
  navScore: '乐谱',
  navAudio: '原曲',

  // 乐谱页工具栏
  libraryTitle: '我的乐谱',
  loadScore: '加载乐谱',

  // 乐器
  instrumentPiano: '钢琴',
  instrumentSaxophone: '萨克斯',
  instrumentGuitar: '吉他',
  instrumentBass: '贝斯',
  instrumentViolin: '小提琴',
  instrumentFlute: '长笛',
  instrumentTrumpet: '小号',

  // 示范曲信息
  demoScoreTitle: '小星星',
  demoScoreComposer: '传统童谣',
  keyCMajor: 'C 大调',

  // 纸面乐谱卡
  notationPlaceholder: '乐谱将在此渲染——渲染与播放引擎尚未接入。',
  notationFootInfo: 'OSMD · SVG 渲染 · 自适应宽度',

  // 选择信息
  selectionNone: '未选择',
  selectionHint: '单击音符选小节 · 双击两点定乐句',

  // 走带
  play: '播放',
  stop: '停止',

  // 速度
  tempoLabel: '速度',
  bpmUnit: 'BPM',

  // 节拍器
  metronomeLabel: '节拍器',
  metronomeOn: '开',
  metronomeOff: '关',
  metronomeSettings: '节拍器设置',
  soundName: '音色',
  metroSoundClassic: '经典',
  metroSoundDigital: '电子',
  metroSoundKick: '底鼓',
  metroSoundClick: '敲击',
  strongVolume: '强拍音量',
  weakVolume: '弱拍音量',

  // 空拍（循环跳过）
  skipLabel: '空拍',
  skipPerLoop: (n: number) => `轮间 ${n} 拍`,
  skipOff: '关闭',
  skipBeatsShort: (n: number) => `${n} 拍`,

  // 状态栏
  statusSelection: '选择',
  statusSkip: '跳过',
  statusInstrument: '乐器',
  statusPlaying: '播放中',
  statusStopped: '已停止',

  // 加载乐谱弹窗
  loadScoreTitle: '加载乐谱',
  dropMain: '拖放文件到此处，或',
  dropBrowse: '浏览文件',
  dropHint: '支持 .musicxml · .xml · .mxl，在浏览器本地解析',
  recentFiles: '最近文件',
  recentEmpty: '暂无历史文件',
  delete: '删除',
  localNote: '文件保存在本机浏览器（IndexedDB）',
  closeHint: '关闭',

  // 原曲页
  audioDropMain: '拖放音频文件到此处，或',
  audioDropHint: '支持 mp3 · wav · ogg · m4a，在浏览器本地处理',
  audioStubHint: '演示模式：点击载入示例音频（暂无声音）',
  removeAudio: '移除音频',
  sliceTag: (start: string, end: string) => `切片 ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `循环 ${seconds} 秒`,
  loopRange: (start: string, end: string) => `循环区间 ${start} → ${end}`,
  gapInfo: (beats: number, duration: string) => `每轮 +${beats} 拍静音（约 ${duration}）`,
  waveHint: '拖拽波形新建切片 · 拖动边界微调 · 双击移除',
  demoAudioName: '示例音频.mp3',
}
