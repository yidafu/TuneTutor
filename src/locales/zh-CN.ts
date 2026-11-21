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
  instrumentClarinet: '单簧管',
  instrumentFlute: '长笛',
  instrumentTrumpet: '小号',
  instrumentFrenchHorn: '圆号',
  instrumentTrombone: '长号',
  instrumentViolin: '小提琴',
  instrumentCello: '大提琴',
  instrumentGuitar: '民谣吉他',
  instrumentGuitarNylon: '古典吉他',
  instrumentBass: '贝斯',

  // 示范曲信息
  untitledScore: '未命名乐谱',

  // 纸面乐谱卡
  notationPlaceholder: '乐谱将在此渲染——渲染与播放引擎尚未接入。',
  notationFootInfo: 'OSMD · SVG 渲染 · 自适应宽度',
  notationZoomIn: '放大乐谱',
  notationZoomOut: '缩小乐谱',

  // 选择信息
  selectionNone: '未选择',
  selectionHint: '单击音符选小节 · 双击两点定乐句 · 空白处拖拽框选',
  selectionPhrase: '乐句',
  selectionMeasure: '小节',
  selectionBox: '框选',
  selectionMeasures: (from: number, to: number) =>
    from === to ? `第 ${from} 小节` : `第 ${from} – ${to} 小节`,
  selectionNoteCount: (n: number) => `${n} 个音符`,
  selectionClear: '清除选择',
  selectionInvalid: '该选择没有可播放区间',

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
  removeAudio: '移除音频',
  sliceTag: (start: string, end: string) => `切片 ${start} – ${end}`,
  loopChipLabel: (seconds: number) => `循环 ${seconds} 秒`,
  loopRange: (start: string, end: string) => `循环区间 ${start} → ${end}`,
  gapInfo: (beats: number, duration: string) => `每轮 +${beats} 拍静音（约 ${duration}）`,
  waveHint: '拖拽波形新建切片 · 拖动切片移位 · 拖动边界微调 · 双击移除 · 双指平移/捏合缩放',
  audioDropOverlay: '松开导入音频',
  zoomOut: '缩小波形',
  zoomIn: '放大波形',
  zoomFit: '适应窗口',
  audioLibraryTitle: '音频库',
  recentAudio: '最近音频',
  audioRecentEmpty: '尚未导入音频',
  importingAudio: '音频导入中…',

  // 乐谱导入错误（docs/musicxml.md §6，E1–E4）
  importing: '正在解析乐谱…',
  errorCorruptArchive: '压缩包已损坏：无法读取该 .mxl 文件',
  errorNotMusicXML: '格式不支持：仅支持 MusicXML score-partwise 乐谱',
  errorParseFailed: '乐谱文件解析失败',
  errorUnsupportedEncoding: '编码不支持：仅支持 UTF-8 的 MusicXML 文件',

  // 音频导入错误（docs/audio.md §5.1 双重校验）
  errorUnsupportedAudio: '音频格式不支持：请使用 mp3、wav、ogg 或 m4a',
  errorAudioDecode: '音频文件解码失败',

  // 皮肤切换
  theme: {
    label: '皮肤',
    group: {
      classic: '经典',
      antique: '古风',
    },
    paper: '纸墨',
    nocturne: '夜曲',
    walnut: '暖木',
    celadon: '青瓷',
    stage: '演奏会',
    cobalt: '青花',
    palace: '宫墙',
    rosewood: '红木',
    lacquer: '玄漆',
    appliedHint: '即时生效 · 记忆在本机',
  },
}
