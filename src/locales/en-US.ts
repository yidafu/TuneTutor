/**
 * English translations
 */
export const enUS = {
  // Header
  appTitle: 'Tune Tutor',
  loadFile: 'Load File',

  // Instruments
  instrument_piano: 'Piano',
  instrument_saxophone: 'Saxophone',
  instrument_guitar: 'Guitar',
  instrument_bass: 'Bass',
  instrument_violin: 'Violin',
  instrument_flute: 'Flute',
  instrument_trumpet: 'Trumpet',

  // PlaybackControls
  tempo: 'Tempo',
  bpm: 'BPM',
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  loopSkip: 'Loop Skip',
  loop: 'Loop',
  off: 'Off',
  metronome: 'Metronome',
  metronomeSound: 'Sound',
  metronomeSound_classic: 'Classic',
  metronomeSound_digital: 'Digital',
  metronomeSound_kick: 'Kick',
  metronomeSound_click: 'Click',
  metronomeStrongBeat: 'Strong Beat',
  metronomeWeakBeat: 'Weak Beat',

  // StatusBar
  noSelection: 'No selection',
  selected: 'Selected:',
  tempoLabel: 'Tempo:',
  instrument: 'Instrument:',
  loopConfigSkip: 'Skip: {0}',

  // ScoreInfo
  composer: 'Composer:',

  // SelectionInfo
  clickToSelect: 'Click notes to select',
  note: 'note',
  notes: 'notes',
  clearSelection: 'Clear Selection',

  // FileLoaderModal
  loadSheetMusic: 'Load Sheet Music',
  supportedFormats: 'Supported formats: .musicxml, .xml',

  // Selection formatting
  measure: 'Measure {0}',
  measures: 'Measures {0}-{1}',

  // Language switcher
  language: 'Language',
  chinese: '繁體中文',
  english: 'English',
  french: 'Français',

  // Loop modes
  loopPhrase: 'Phrase',
  phraseSelected: 'Phrase',

  // Navigation
  navScore: 'Score',
  navOriginalAudio: 'Original Audio',

  // OriginalAudio page
  originalAudio: 'Original Audio Practice',
  importAudio: 'Import audio',
  importAudioHint: 'Drop audio here or click to browse (mp3, wav, ogg, m4a)',
  removeAudio: 'Remove',
  audioDuration: 'Duration: {0}',
  sliceRange: '{0} – {1}',
  sliceDurationLabel: 'Slice: {0}',
  gapBeats: 'Empty beats',
  dragToSelect: 'Drag on the waveform to select a slice to loop',
  audioPlayLoop: 'Loop slice',
  audioPlayWhole: 'Play full',
  unsupportedAudioFormat: 'Unsupported audio format. Try mp3, wav, ogg, or m4a.',
} as const;

export type English = typeof enUS;
