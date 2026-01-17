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
  off: 'Off',

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
} as const;

export type English = typeof enUS;
